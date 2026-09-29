import { and, eq, sql as dsql } from "drizzle-orm";
import { db, schema } from "@/db";
import { safeEqual } from "./crypto";
import { queueEmail, flushOutbox, appUrl } from "./email";

const { orders, orderItems, products, inventoryItems, warrantyClaims, auditLog } = schema;

export class ClaimError extends Error {}

/** Customer opens a claim: token proves ownership, warranty window and one-open-claim rules are enforced here. */
export async function openClaim(input: { orderId: string; token: string; orderItemId: string; reason: string }) {
  const reason = input.reason.trim();
  if (reason.length < 10 || reason.length > 2000) throw new ClaimError("Please describe the problem (10–2000 characters).");

  const row = (await db
    .select({ o: orders, warrantyDays: products.warrantyDays })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(products, eq(products.id, orderItems.productId))
    .where(and(eq(orderItems.id, input.orderItemId), eq(orderItems.orderId, input.orderId))))[0];
  if (!row || !safeEqual(row.o.accessToken, input.token)) throw new ClaimError("Order not found.");
  if (row.o.status !== "delivered" || !row.o.deliveredAt) throw new ClaimError("Only delivered orders are covered by warranty.");
  if (Date.now() > row.o.deliveredAt.getTime() + row.warrantyDays * 86_400_000) throw new ClaimError("The warranty period has ended.");

  return db.transaction(async (tx) => {
    const open = await tx.select({ id: warrantyClaims.id }).from(warrantyClaims)
      .where(and(eq(warrantyClaims.orderItemId, input.orderItemId), eq(warrantyClaims.status, "open")));
    if (open.length) throw new ClaimError("You already have an open claim for this account.");
    const [claim] = await tx.insert(warrantyClaims).values({ orderItemId: input.orderItemId, reason }).returning();
    await tx.insert(auditLog).values({ actor: `customer:${row.o.email}`, action: "claim_opened", target: claim.id });
    return claim;
  });
}

/**
 * Swap the buyer's account for a fresh one of the same product.
 * The old account is retired ('replaced'), never resold.
 */
export async function replaceAccount(claimId: string, actor = "admin"): Promise<"replaced" | "no_stock" | "not_open"> {
  const outcome = await db.transaction(async (tx) => {
    const claim = (await tx.execute<{ id: string; status: string; order_item_id: string }>(dsql`
      SELECT id, status, order_item_id FROM warranty_claims WHERE id = ${claimId} FOR UPDATE`))[0];
    if (!claim || claim.status !== "open") return "not_open" as const;

    const item = (await tx.select().from(orderItems).where(eq(orderItems.id, claim.order_item_id)))[0];
    const fresh = (await tx.execute<{ id: string }>(dsql`
      SELECT id FROM inventory_items WHERE product_id = ${item.productId} AND status = 'available'
      ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED`))[0];
    if (!fresh) return "no_stock" as const;

    await tx.update(inventoryItems).set({ status: "sold", reservedByOrderId: item.orderId }).where(eq(inventoryItems.id, fresh.id));
    await tx.update(inventoryItems).set({ status: "replaced" }).where(eq(inventoryItems.id, item.inventoryItemId));
    await tx.update(orderItems).set({ inventoryItemId: fresh.id }).where(eq(orderItems.id, item.id));
    await tx.update(warrantyClaims).set({
      status: "replaced", oldInventoryItemId: item.inventoryItemId, newInventoryItemId: fresh.id, resolvedAt: new Date(),
    }).where(eq(warrantyClaims.id, claimId));
    await tx.insert(auditLog).values({ actor, action: "claim_replaced", target: claimId });

    const order = (await tx.select().from(orders).where(eq(orders.id, item.orderId)))[0];
    await queueEmail(tx, {
      to: order.email,
      subject: "Your account has been replaced",
      body: `We replaced the account from your warranty claim.\n\nNew details: ${appUrl()}/order/${order.id}?token=${order.accessToken}`,
    });
    return "replaced" as const;
  });
  if (outcome === "replaced") void flushOutbox().catch(() => {});
  return outcome;
}

export async function rejectClaim(claimId: string, note: string, actor = "admin") {
  await db.transaction(async (tx) => {
    const res = await tx.update(warrantyClaims)
      .set({ status: "rejected", adminNote: note.slice(0, 1000), resolvedAt: new Date() })
      .where(and(eq(warrantyClaims.id, claimId), eq(warrantyClaims.status, "open"))).returning();
    if (!res.length) return;
    await tx.insert(auditLog).values({ actor, action: "claim_rejected", target: claimId, meta: { note } });
    const row = (await tx.select({ email: orders.email }).from(warrantyClaims)
      .innerJoin(orderItems, eq(orderItems.id, warrantyClaims.orderItemId))
      .innerJoin(orders, eq(orders.id, orderItems.orderId)).where(eq(warrantyClaims.id, claimId)))[0];
    if (row) await queueEmail(tx, { to: row.email, subject: "Update on your warranty claim", body: `We could not approve your claim.\n\n${note}` });
  });
  void flushOutbox().catch(() => {});
}
