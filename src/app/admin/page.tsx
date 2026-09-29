import Link from "next/link";
import { sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { requireAdmin, endSession } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

async function logout() { "use server"; await endSession(); redirect("/admin/login"); }

export default async function Admin() {
  await requireAdmin();
  const [s] = await db.execute<{ revenue: string; cost: string; orders: number; disputed: number; stock: number; low: number }>(dsql`
    SELECT
      COALESCE((SELECT sum(total_cents) FROM orders WHERE status = 'delivered'), 0) AS revenue,
      COALESCE((SELECT sum(i.cost_cents) FROM inventory_items i WHERE i.status = 'sold'), 0) AS cost,
      (SELECT count(*)::int FROM orders WHERE status = 'delivered') AS orders,
      (SELECT count(*)::int FROM orders WHERE status = 'disputed') AS disputed,
      (SELECT count(*)::int FROM inventory_items WHERE status = 'available') AS stock,
      (SELECT count(*)::int FROM (SELECT product_id FROM inventory_items WHERE status='available' GROUP BY product_id HAVING count(*) <= 1) t) AS low`);
  const revenue = Number(s.revenue), cost = Number(s.cost);

  const cards = [
    ["Revenue", money(revenue)], ["Gross margin", money(revenue - cost)], ["Delivered orders", s.orders],
    ["In stock", s.stock], ["Low stock products", s.low], ["Needs manual review", s.disputed],
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <form action={logout}><button className="btn-ghost text-sm">Sign out</button></form>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map(([k, v]) => (
          <div key={String(k)} className="card p-4"><p className="muted text-sm">{k}</p><p className="text-2xl font-bold">{String(v)}</p></div>
        ))}
      </div>
      <div className="flex gap-3">
        <Link href="/admin/orders" className="btn">Orders</Link>
        <Link href="/admin/products" className="btn">Products</Link>
        <Link href="/admin/inventory" className="btn">Inventory</Link>
        <Link href="/admin/claims" className="btn">Claims</Link>
      </div>
    </div>
  );
}
