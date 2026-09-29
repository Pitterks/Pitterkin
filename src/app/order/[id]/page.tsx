import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getOrderForCustomer } from "@/lib/orders";
import { money } from "@/lib/format";
import { AutoRefresh } from "@/components/AutoRefresh";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { inArray } from "drizzle-orm";
import { openClaim, ClaimError } from "@/lib/warranty";
import { rateLimit } from "@/lib/ratelimit";

async function submitClaim(form: FormData) {
  "use server";
  const orderId = String(form.get("orderId")), token = String(form.get("token"));
  const back = (q: string) => redirect(`/order/${orderId}?token=${encodeURIComponent(token)}&${q}#claims`);
  if (!rateLimit(`claim:${orderId}`, 5, 3600_000)) return back("claimError=Too%20many%20requests");
  try {
    await openClaim({ orderId, token, orderItemId: String(form.get("orderItemId")), reason: String(form.get("reason") ?? "") });
  } catch (e) {
    if (e instanceof ClaimError) return back(`claimError=${encodeURIComponent(e.message)}`);
    throw e;
  }
  back("claim=ok");
}

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

const STATUS: Record<string, string> = {
  pending: "Waiting for payment", paid: "Paid", delivered: "Delivered", expired: "Expired (reservation released)",
  refunded: "Refunded", disputed: "Payment received — manual review, support will contact you",
};

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string; claim?: string; claimError?: string }> }) {
  const { id } = await params;
  const { token, claim, claimError } = await searchParams;
  if (!token || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const h = await headers();
  const data = await getOrderForCustomer(id, token, h.get("x-forwarded-for")?.split(",")[0] ?? null);
  if (!data) notFound();
  const { order, lines } = data;
  const claims = lines.length
    ? await db.select().from(schema.warrantyClaims).where(inArray(schema.warrantyClaims.orderItemId, lines.map((l) => l.itemId)))
    : [];

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {order.status === "pending" && <AutoRefresh ms={5000} />}
      <h1 className="text-2xl font-bold">Order {order.id.slice(0, 8)}</h1>
      <div className="card p-4">
        <p className="muted text-sm">Status</p>
        <p className="font-semibold">{STATUS[order.status] ?? order.status}</p>
        <p className="muted mt-2 text-sm">Total {money(order.totalCents, order.currency)} · {order.email}</p>
      </div>
      {lines.map((l, i) => (
        <div key={i} className="card p-4">
          <p className="font-semibold">{l.title}</p>
          {l.credentials ? (
            <>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-3 text-sm">{l.credentials}</pre>
              <p className="muted mt-2 text-xs">Change the password and email right away. Warranty: {l.warrantyDays} days — keep this link.</p>
            </>
          ) : <p className="muted mt-2 text-sm">Credentials appear here right after payment.</p>}
          {l.credentials && (() => {
            const mine = claims.filter((c) => c.orderItemId === l.itemId);
            const open = mine.find((c) => c.status === "open");
            const until = order.deliveredAt ? new Date(order.deliveredAt.getTime() + l.warrantyDays * 86_400_000) : null;
            const active = until && until.getTime() > Date.now();
            return (
              <div id="claims" className="mt-4 border-t pt-3" style={{ borderColor: "var(--line)" }}>
                {mine.map((c) => <p key={c.id} className="muted text-xs">Claim {c.id.slice(0, 6)}: {c.status}{c.adminNote ? ` — ${c.adminNote}` : ""}</p>)}
                {claim === "ok" && <p className="text-sm text-emerald-400">Claim received. We will reply by email.</p>}
                {claimError && <p className="text-sm text-rose-300">{claimError}</p>}
                {active && !open && (
                  <form action={submitClaim} className="mt-2 space-y-2">
                    <input type="hidden" name="orderId" value={order.id} /><input type="hidden" name="token" value={token} /><input type="hidden" name="orderItemId" value={l.itemId} />
                    <textarea name="reason" required minLength={10} rows={3} className="input" placeholder="Describe the problem with this account" />
                    <button className="btn-ghost text-sm">Open warranty claim (until {until!.toLocaleDateString("en-GB")})</button>
                  </form>
                )}
                {!active && <p className="muted text-xs">Warranty period ended.</p>}
              </div>
            );
          })()}
        </div>
      ))}
    </div>
  );
}
