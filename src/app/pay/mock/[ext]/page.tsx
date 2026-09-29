import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { sign } from "@/lib/crypto";
import { mockProvider } from "@/lib/payments/mock";
import { handlePaymentEvent } from "@/lib/orders";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

async function settle(form: FormData) {
  "use server";
  if (!mockProvider.enabled()) return;
  const ext = String(form.get("ext")), token = String(form.get("token")), orderId = String(form.get("order"));
  const status = form.get("result") === "pay" ? "paid" : "failed";
  const pay = (await db.select().from(schema.payments).where(and(eq(schema.payments.provider, "mock"), eq(schema.payments.externalId, ext))))[0];
  if (!pay) return;
  // Go through the same signed-webhook path a real provider would use.
  const body = JSON.stringify({ externalId: ext, status, amountCents: pay.amountCents });
  const ev = await mockProvider.parseWebhook(body, new Headers({ "x-signature": sign(body) }));
  await handlePaymentEvent("mock", ev);
  redirect(`/order/${orderId}?token=${token}`);
}

export default async function MockPay({ params, searchParams }: { params: Promise<{ ext: string }>; searchParams: Promise<{ order?: string; token?: string }> }) {
  if (!mockProvider.enabled()) notFound();
  const { ext } = await params;
  const { order, token } = await searchParams;
  const pay = (await db.select().from(schema.payments).where(and(eq(schema.payments.provider, "mock"), eq(schema.payments.externalId, ext))))[0];
  if (!pay || !order || !token) notFound();
  return (
    <form action={settle} className="card mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-xl font-bold">Test payment</h1>
      <p className="muted text-sm">Dev-only stand-in for a payment gateway.</p>
      <p className="text-3xl font-bold">{money(pay.amountCents, pay.currency)}</p>
      <input type="hidden" name="ext" value={ext} /><input type="hidden" name="order" value={order} /><input type="hidden" name="token" value={token} />
      <div className="flex gap-3">
        <button name="result" value="pay" className="btn flex-1">Pay</button>
        <button name="result" value="fail" className="btn-ghost flex-1">Fail</button>
      </div>
    </form>
  );
}
