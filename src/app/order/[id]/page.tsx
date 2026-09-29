import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getOrderForCustomer } from "@/lib/orders";
import { money } from "@/lib/format";
import { AutoRefresh } from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

const STATUS: Record<string, string> = {
  pending: "Waiting for payment", paid: "Paid", delivered: "Delivered", expired: "Expired (reservation released)",
  refunded: "Refunded", disputed: "Payment received — manual review, support will contact you",
};

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  const { id } = await params;
  const { token } = await searchParams;
  if (!token || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const h = await headers();
  const data = await getOrderForCustomer(id, token, h.get("x-forwarded-for")?.split(",")[0] ?? null);
  if (!data) notFound();
  const { order, lines } = data;

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
        </div>
      ))}
    </div>
  );
}
