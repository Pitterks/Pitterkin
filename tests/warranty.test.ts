import { afterAll, describe, expect, it } from "vitest";
import { sql as dsql, eq } from "drizzle-orm";
import { db, sql, schema } from "@/db";
import { encrypt, sign } from "@/lib/crypto";
import { createOrder, handlePaymentEvent, getOrderForCustomer } from "@/lib/orders";
import { openClaim, replaceAccount, rejectClaim, ClaimError } from "@/lib/warranty";
import { flushOutbox } from "@/lib/email";
import { mockProvider } from "@/lib/payments/mock";

afterAll(() => sql.end());

async function deliveredOrder(stock: number, warrantyDays = 7) {
  await db.execute(dsql`TRUNCATE email_outbox, warranty_claims, audit_log, payments, order_items, orders, inventory_items, products, games CASCADE`);
  const [game] = await db.insert(schema.games).values({ slug: "g", name: "G" }).returning();
  const [product] = await db.insert(schema.products).values({ gameId: game.id, title: "P", priceCents: 1000, warrantyDays }).returning();
  await db.insert(schema.inventoryItems).values(
    Array.from({ length: stock }, (_, i) => ({ productId: product.id, credentialsEnc: encrypt(`acc${i}:pw`) })),
  );
  const { order } = await createOrder({ email: "b@x.com", lines: [{ productId: product.id, qty: 1 }], providerId: "mock" });
  const pay = (await db.select().from(schema.payments))[0];
  const body = JSON.stringify({ externalId: pay.externalId, status: "paid", amountCents: 1000 });
  await handlePaymentEvent("mock", await mockProvider.parseWebhook(body, new Headers({ "x-signature": sign(body) })));
  const item = (await db.select().from(schema.orderItems))[0];
  return { order, item };
}

describe("email outbox", () => {
  it("queues a delivery email with the order link and no credentials, and flushes it once", async () => {
    const { order } = await deliveredOrder(1);
    const rows = await db.select().from(schema.emailOutbox);
    expect(rows).toHaveLength(1);
    expect(rows[0].body).toContain(`/order/${order.id}?token=`);
    expect(rows[0].body).not.toContain("acc0");
    expect(rows[0].body).not.toContain("pw");
    await flushOutbox();
    expect(await flushOutbox()).toBe(0);
    expect((await db.select().from(schema.emailOutbox))[0].sentAt).not.toBeNull();
  });
});

describe("warranty", () => {
  it("opens a claim, replaces the account, retires the old one", async () => {
    const { order, item } = await deliveredOrder(2);
    const claim = await openClaim({ orderId: order.id, token: order.accessToken, orderItemId: item.id, reason: "Account is banned" });
    expect(await replaceAccount(claim.id)).toBe("replaced");
    const view = await getOrderForCustomer(order.id, order.accessToken);
    expect(view?.lines[0].credentials).toBe("acc1:pw");
    const inv = await db.select().from(schema.inventoryItems);
    expect(inv.map((i) => i.status).sort()).toEqual(["replaced", "sold"]);
    expect(await replaceAccount(claim.id)).toBe("not_open");
  });

  it("keeps the claim open when there is no replacement stock", async () => {
    const { order, item } = await deliveredOrder(1);
    const claim = await openClaim({ orderId: order.id, token: order.accessToken, orderItemId: item.id, reason: "Password does not work" });
    expect(await replaceAccount(claim.id)).toBe("no_stock");
    expect((await db.select().from(schema.warrantyClaims).where(eq(schema.warrantyClaims.id, claim.id)))[0].status).toBe("open");
  });

  it("rejects wrong token, short reason, duplicate open claim and expired warranty", async () => {
    const { order, item } = await deliveredOrder(2);
    const base = { orderId: order.id, orderItemId: item.id };
    await expect(openClaim({ ...base, token: "bad", reason: "long enough reason" })).rejects.toThrow(ClaimError);
    await expect(openClaim({ ...base, token: order.accessToken, reason: "short" })).rejects.toThrow(ClaimError);
    await openClaim({ ...base, token: order.accessToken, reason: "long enough reason" });
    await expect(openClaim({ ...base, token: order.accessToken, reason: "another long reason" })).rejects.toThrow(/open claim/);

    await db.execute(dsql`UPDATE orders SET delivered_at = now() - interval '8 days'`);
    await db.execute(dsql`UPDATE warranty_claims SET status = 'rejected'`);
    await expect(openClaim({ ...base, token: order.accessToken, reason: "long enough reason" })).rejects.toThrow(/ended/);
  });

  it("concurrent replacements consume exactly one spare", async () => {
    const { order, item } = await deliveredOrder(2);
    const claim = await openClaim({ orderId: order.id, token: order.accessToken, orderItemId: item.id, reason: "Account is banned" });
    const out = await Promise.all([replaceAccount(claim.id), replaceAccount(claim.id), replaceAccount(claim.id)]);
    expect(out.filter((o) => o === "replaced")).toHaveLength(1);
  });

  it("reject emails the customer with the reason", async () => {
    const { order, item } = await deliveredOrder(1);
    const claim = await openClaim({ orderId: order.id, token: order.accessToken, orderItemId: item.id, reason: "I changed the password myself" });
    await rejectClaim(claim.id, "Password was changed by the buyer");
    const mails = await db.select().from(schema.emailOutbox);
    expect(mails.some((m) => m.body.includes("Password was changed by the buyer"))).toBe(true);
  });
});
