import { randomBytes } from "node:crypto";
import { and, eq, inArray, lt, sql as dsql } from "drizzle-orm";
import { db, schema, type Tx } from "@/db";
import { decrypt, safeEqual } from "./crypto";
import { getProvider } from "./payments";
import type { PaymentEvent } from "./payments/types";

const { inventoryItems, orders, orderItems, payments, products, auditLog } = schema;

export const RESERVATION_MINUTES = 30;
export const MAX_QTY_PER_PRODUCT = 3;

export class OrderError extends Error {}

export type CartLine = { productId: string; qty: number };

/** Free reservations of unpaid orders whose time ran out. */
export async function sweepExpired(tx: Pick<Tx, "update" | "select"> = db) {
  const stale = await tx
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.status, "pending"), lt(orders.createdAt, dsql`now() - make_interval(mins => ${RESERVATION_MINUTES})`)));
  if (!stale.length) return 0;
  const ids = stale.map((o) => o.id);
  await tx.update(orders).set({ status: "expired" }).where(inArray(orders.id, ids));
  await tx
    .update(inventoryItems)
    .set({ status: "available", reservedUntil: null, reservedByOrderId: null })
    .where(and(eq(inventoryItems.status, "reserved"), inArray(inventoryItems.reservedByOrderId, ids)));
  return ids.length;
}

export async function createOrder(input: {
  email: string;
  lines: CartLine[];
  providerId: string;
  ip?: string | null;
}) {
  const provider = getProvider(input.providerId);
  if (!provider) throw new OrderError("Payment method unavailable");
  if (!input.lines.length) throw new OrderError("Cart is empty");

  const created = await db.transaction(async (tx) => {
    await sweepExpired(tx);

    const orderRow = (
      await tx.insert(orders).values({
        email: input.email.trim().toLowerCase(),
        accessToken: randomBytes(24).toString("base64url"),
        totalCents: 0,
        ip: input.ip ?? null,
      }).returning()
    )[0];

    let total = 0;
    let currency = "USD";
    for (const line of input.lines) {
      if (line.qty < 1 || line.qty > MAX_QTY_PER_PRODUCT) throw new OrderError("Invalid quantity");
      const product = (await tx.select().from(products).where(and(eq(products.id, line.productId), eq(products.active, true))))[0];
      if (!product) throw new OrderError("Product not found");
      currency = product.currency;

      // SKIP LOCKED: concurrent buyers never wait on or double-take an account.
      const picked = await tx.execute<{ id: string }>(dsql`
        SELECT id FROM inventory_items
        WHERE product_id = ${product.id} AND status = 'available'
        ORDER BY created_at
        LIMIT ${line.qty}
        FOR UPDATE SKIP LOCKED`);
      if (picked.length < line.qty) throw new OrderError(`Not enough stock: ${product.title}`);

      await tx
        .update(inventoryItems)
        .set({
          status: "reserved",
          reservedByOrderId: orderRow.id,
          reservedUntil: dsql`now() + make_interval(mins => ${RESERVATION_MINUTES})`,
        })
        .where(inArray(inventoryItems.id, picked.map((r) => r.id)));
      await tx.insert(orderItems).values(
        picked.map((r) => ({ orderId: orderRow.id, productId: product.id, inventoryItemId: r.id, priceCents: product.priceCents })),
      );
      total += product.priceCents * line.qty;
    }

    await tx.update(orders).set({ totalCents: total, currency }).where(eq(orders.id, orderRow.id));
    return { ...orderRow, totalCents: total, currency };
  });

  try {
    const pay = await provider.createPayment({
      orderId: created.id, amountCents: created.totalCents, currency: created.currency, email: created.email,
    });
    await db.insert(payments).values({
      orderId: created.id, provider: provider.id, externalId: pay.externalId,
      amountCents: created.totalCents, currency: created.currency,
    });
    return { order: created, redirectUrl: pay.redirectUrl };
  } catch (e) {
    await cancelOrder(created.id);
    throw e;
  }
}

export async function cancelOrder(orderId: string) {
  await db.transaction(async (tx) => {
    await tx.update(orders).set({ status: "expired" }).where(and(eq(orders.id, orderId), eq(orders.status, "pending")));
    await tx
      .update(inventoryItems)
      .set({ status: "available", reservedUntil: null, reservedByOrderId: null })
      .where(and(eq(inventoryItems.reservedByOrderId, orderId), eq(inventoryItems.status, "reserved")));
  });
}

export type PaymentOutcome = "delivered" | "duplicate" | "unknown_payment" | "failed" | "amount_mismatch" | "needs_manual";

/**
 * Idempotent: the payment row is locked, so the same webhook delivered twice
 * (or concurrently) delivers exactly once.
 */
export async function handlePaymentEvent(providerId: string, ev: PaymentEvent): Promise<PaymentOutcome> {
  return db.transaction(async (tx) => {
    const rows = await tx.execute<{ id: string; order_id: string; status: string; amount_cents: number }>(dsql`
      SELECT id, order_id, status, amount_cents FROM payments
      WHERE provider = ${providerId} AND external_id = ${ev.externalId}
      FOR UPDATE`);
    const pay = rows[0];
    if (!pay) return "unknown_payment";

    await tx
      .update(payments)
      .set({ rawEvents: dsql`raw_events || ${JSON.stringify([ev.raw])}::jsonb` })
      .where(eq(payments.id, pay.id));

    if (pay.status === "paid") return "duplicate";
    if (ev.status !== "paid") {
      await tx.update(payments).set({ status: ev.status }).where(eq(payments.id, pay.id));
      return "failed";
    }
    if (ev.amountCents !== pay.amount_cents) {
      await tx.insert(auditLog).values({
        actor: `payment:${providerId}`, action: "amount_mismatch", target: pay.order_id,
        meta: { expected: pay.amount_cents, got: ev.amountCents },
      });
      return "amount_mismatch";
    }

    await tx.update(payments).set({ status: "paid" }).where(eq(payments.id, pay.id));

    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, pay.order_id));
    const ids = items.map((i) => i.inventoryItemId);
    // Lock the accounts. Late payment (reservation expired) still succeeds if
    // nobody else took them; otherwise it goes to manual handling / refund.
    const locked = await tx.execute<{ id: string; status: string; reserved_by_order_id: string | null }>(dsql`
      SELECT id, status, reserved_by_order_id FROM inventory_items
      WHERE id IN ${ids} FOR UPDATE`);
    const ok = locked.length === ids.length &&
      locked.every((r) => r.status === "available" || (r.status === "reserved" && r.reserved_by_order_id === pay.order_id));

    if (!ok) {
      await tx.update(orders).set({ status: "disputed", paidAt: new Date() }).where(eq(orders.id, pay.order_id));
      await tx.insert(auditLog).values({ actor: `payment:${providerId}`, action: "paid_but_unavailable", target: pay.order_id });
      return "needs_manual";
    }

    await tx
      .update(inventoryItems)
      .set({ status: "sold", reservedUntil: null, reservedByOrderId: pay.order_id })
      .where(inArray(inventoryItems.id, ids));
    await tx.update(orders).set({ status: "delivered", paidAt: new Date(), deliveredAt: new Date() }).where(eq(orders.id, pay.order_id));
    return "delivered";
  });
}

/** Guest-safe order view. Credentials are decrypted only for delivered orders and the view is logged. */
export async function getOrderForCustomer(orderId: string, token: string, ip?: string | null) {
  const order = (await db.select().from(orders).where(eq(orders.id, orderId)))[0];
  if (!order || !safeEqual(order.accessToken, token)) return null;

  const lines = await db
    .select({
      title: products.title,
      warrantyDays: products.warrantyDays,
      credentialsEnc: inventoryItems.credentialsEnc,
    })
    .from(orderItems)
    .innerJoin(products, eq(products.id, orderItems.productId))
    .innerJoin(inventoryItems, eq(inventoryItems.id, orderItems.inventoryItemId))
    .where(eq(orderItems.orderId, orderId));

  const delivered = order.status === "delivered";
  if (delivered) {
    await db.insert(auditLog).values({ actor: `customer:${order.email}`, action: "delivery_viewed", target: order.id, ip: ip ?? null });
  }
  return {
    order: { id: order.id, status: order.status, email: order.email, totalCents: order.totalCents, currency: order.currency, createdAt: order.createdAt },
    lines: lines.map((l) => ({
      title: l.title,
      warrantyDays: l.warrantyDays,
      credentials: delivered ? decrypt(l.credentialsEnc) : null,
    })),
  };
}
