import Link from "next/link";
import { eq, sql as dsql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";
const { products, games, inventoryItems } = schema;

export default async function AdminProducts() {
  await requireAdmin();
  const rows = await db
    .select({
      p: products, game: games.name,
      stock: dsql<number>`count(*) filter (where ${inventoryItems.status} = 'available')::int`,
    })
    .from(products).innerJoin(games, eq(games.id, products.gameId))
    .leftJoin(inventoryItems, eq(inventoryItems.productId, products.id))
    .groupBy(products.id, games.name).orderBy(products.createdAt);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
        <div className="flex gap-2"><Link href="/admin/games" className="btn-ghost">Games</Link><Link href="/admin/products/new" className="btn">New product</Link></div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="muted"><tr><th className="p-3">Title</th><th>Game</th><th>Price</th><th>Stock</th><th>Status</th></tr></thead>
          <tbody>{rows.map(({ p, game, stock }) => (
            <tr key={p.id} className="border-t" style={{ borderColor: "var(--line)" }}>
              <td className="p-3"><Link className="underline" href={`/admin/products/${p.id}`}>{p.title}</Link></td>
              <td>{game}</td><td>{money(p.priceCents, p.currency)}</td><td>{stock}</td><td>{p.active ? "Active" : "Hidden"}</td>
            </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
