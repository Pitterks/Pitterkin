import { beforeEach, afterAll, describe, expect, it } from "vitest";
import { sql as dsql } from "drizzle-orm";
import { db, sql, schema } from "@/db";
import { encrypt, decrypt, sign } from "@/lib/crypto";
import { createOrder, handlePaymentEvent, getOrderForCustomer, sweepExpired, OrderError } from "@/lib/orders";
import { mockProvider } from "@/lib/payments/mock";

async function setup(stock: number) {
  await db.execute(dsql`TRUNCATE audit_log, payments, order_items, orders, inventory_items, products, games CASCADE`);
  const [game] = await db.insert(schema.games).values({ slug: "g", name: "G" }).returning();
  const [product] = await db.insert(schema.products).values({ gameId: game.id, title: "P", priceCents: 1000 }).returning();
  await db.insert(schema.inventoryItems).values(
    Array.from({ length: stock }, (_, i) => ({ productId: product.id, credentialsEnc: encrypt(`login${i}:pw`) })),
  );
  return product;
}

async function pay(externalId: string, amountCents: number, status: "paid" | "failed" = "paid") {
  const body = JSON.stringify({ externalId, status, amountCents });
  const ev = await mockProvider.parseWebhook(body, new Headers({ "x-signature": sign(body) }));
  return handlePaymentEvent("mock", ev);
}

const externalIdOf = async (orderId: string) =>
  (await db.select().from(schema.payments).where(dsql`order_id = ${orderId}`))[0].externalId!;

beforeEach(() => void 0);
afterAll(() => sql.end());

describe("crypto", () => {
  it("round-trips and rejects tampering", () => {
    const c = encrypt("secret");
    expect(decrypt(c)).toBe("secret");
    const buf = Buffer.from(c, "base64"); buf[buf.length - 1] ^= 1;
    expect(() => decrypt(buf.toString("base64"))).toThrow();
  });
});

describe("mock webhook", () => {
  it("rejects a bad signature", async () => {
    await expect(mockProvider.parseWebhook("{}", new Headers({ "x-signature": "nope" }))).rejects.toThrow();
  });
});

describe("orders", () => {
  it("buy → pay → delivered with decrypted credentials", async () => {
    const p = await setup(1);
    const { order } = await createOrder({ email: "A@x.com", lines: [{ productId: p.id, qty: 1 }], providerId: "mock" });
    expect(order.totalCents).toBe(1000);
    expect(await pay(await externalIdOf(order.id), 1000)).toBe("delivered");
    const view = await getOrderForCustomer(order.id, order.accessToken);
    expect(view?.order.status).toBe("delivered");
    expect(view?.lines[0].credentials).toBe("login0:pw");
  });

  it("hides credentials before payment and rejects a wrong token", async () => {
    const p = await setup(1);
    const { order } = await createOrder({ email: "a@x.com", lines: [{ productId: p.id, qty: 1 }], providerId: "mock" });
    expect((await getOrderForCustomer(order.id, order.accessToken))?.lines[0].credentials).toBeNull();
    expect(await getOrderForCustomer(order.id, "wrong")).toBeNull();
  });

  it("never sells one account twice under concurrency", async () => {
    const p = await setup(3);
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) =>
        createOrder({ email: `u${i}@x.com`, lines: [{ productId: p.id, qty: 1 }], providerId: "mock" })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected.every((r) => r.reason instanceof OrderError)).toBe(true);
    const reserved = await db.select().from(schema.inventoryItems).where(dsql`status = 'reserved'`);
    expect(new Set(reserved.map((r) => r.reservedByOrderId)).size).toBe(3);
  });

  it("is idempotent: duplicate and concurrent webhooks deliver once", async () => {
    const p = await setup(1);
    const { order } = await createOrder({ email: "a@x.com", lines: [{ productId: p.id, qty: 1 }], providerId: "mock" });
    const ext = await externalIdOf(order.id);
    const out = await Promise.all([pay(ext, 1000), pay(ext, 1000), pay(ext, 1000)]);
    expect(out.filter((o) => o === "delivered")).toHaveLength(1);
    expect(out.filter((o) => o === "duplicate")).toHaveLength(2);
  });

  it("refuses to deliver when the paid amount differs", async () => {
    const p = await setup(1);
    const { order } = await createOrder({ email: "a@x.com", lines: [{ productId: p.id, qty: 1 }], providerId: "mock" });
    expect(await pay(await externalIdOf(order.id), 1)).toBe("amount_mismatch");
    expect((await getOrderForCustomer(order.id, order.accessToken))?.order.status).toBe("pending");
  });

  it("ignores prices/qty abuse", async () => {
    const p = await setup(5);
    await expect(createOrder({ email: "a@x.com", lines: [{ productId: p.id, qty: 99 }], providerId: "mock" })).rejects.toThrow(OrderError);
    await expect(createOrder({ email: "a@x.com", lines: [{ productId: p.id, qty: 1 }], providerId: "nope" })).rejects.toThrow(OrderError);
  });

  it("frees expired reservations, and late payment still delivers if stock untouched", async () => {
    const p = await setup(1);
    const { order } = await createOrder({ email: "a@x.com", lines: [{ productId: p.id, qty: 1 }], providerId: "mock" });
    await db.execute(dsql`UPDATE orders SET created_at = now() - interval '2 hours' WHERE id = ${order.id}`);
    expect(await sweepExpired()).toBe(1);
    expect((await db.select().from(schema.inventoryItems))[0].status).toBe("available");
    expect(await pay(await externalIdOf(order.id), 1000)).toBe("delivered");
  });

  it("late payment after the account was resold goes to manual handling", async () => {
    const p = await setup(1);
    const first = await createOrder({ email: "a@x.com", lines: [{ productId: p.id, qty: 1 }], providerId: "mock" });
    await db.execute(dsql`UPDATE orders SET created_at = now() - interval '2 hours' WHERE id = ${first.order.id}`);
    const second = await createOrder({ email: "b@x.com", lines: [{ productId: p.id, qty: 1 }], providerId: "mock" });
    expect(await pay(await externalIdOf(second.order.id), 1000)).toBe("delivered");
    expect(await pay(await externalIdOf(first.order.id), 1000)).toBe("needs_manual");
    const o = (await db.select().from(schema.orders).where(dsql`id = ${first.order.id}`))[0];
    expect(o.status).toBe("disputed");
  });
});
