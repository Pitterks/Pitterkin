import { desc, eq, sql as dsql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";
const { orders, auditLog, inventoryItems } = schema;

/** Refund bookkeeping only: money is returned in the payment provider's dashboard. */
async function markRefunded(form: FormData) {
  "use server";
  await requireAdmin();
  const id = String(form.get("id"));
  await db.transaction(async (tx) => {
    await tx.update(orders).set({ status: "refunded" }).where(eq(orders.id, id));
    // the account stays "sold": it was exposed to the buyer and must not be resold blindly
    await tx.update(inventoryItems).set({ status: "blocked" }).where(dsql`reserved_by_order_id = ${id} AND status = 'sold'`);
    await tx.insert(auditLog).values({ actor: "admin", action: "order_refunded", target: id });
  });
  revalidatePath("/admin/orders");
}

export default async function AdminOrders() {
  await requireAdmin();
  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(100);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Orders</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="muted"><tr><th className="p-3">Order</th><th>Email</th><th>Total</th><th>Status</th><th>Created</th><th /></tr></thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                <td className="p-3 font-mono">{o.id.slice(0, 8)}</td><td>{o.email}</td><td>{money(o.totalCents, o.currency)}</td>
                <td>{o.status}</td><td>{o.createdAt.toLocaleString("en-GB")}</td>
                <td className="pr-3 text-right">
                  {(o.status === "delivered" || o.status === "disputed") && (
                    <form action={markRefunded}><input type="hidden" name="id" value={o.id} /><button className="btn-ghost">Mark refunded</button></form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
