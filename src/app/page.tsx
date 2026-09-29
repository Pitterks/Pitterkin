import Link from "next/link";
import { desc, eq, sql as dsql } from "drizzle-orm";
import { db, schema } from "@/db";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";
const { products, games, inventoryItems } = schema;

export default async function Home() {
  const gameRows = await db.select().from(games).where(eq(games.active, true));
  const latest = await db
    .select({
      p: products, game: games,
      stock: dsql<number>`(select count(*)::int from ${inventoryItems} i where i.product_id = products.id and i.status = 'available')`,
    })
    .from(products).innerJoin(games, eq(games.id, products.gameId))
    .where(eq(products.active, true)).orderBy(desc(products.createdAt)).limit(6);

  return (
    <div className="space-y-10">
      <section className="card p-8">
        <h1 className="text-3xl font-bold">Game accounts, delivered instantly</h1>
        <p id="warranty" className="muted mt-2 max-w-xl">Verified accounts with full access, secure crypto checkout and a replacement warranty on every order.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {gameRows.map((g) => <Link key={g.id} href={`/games/${g.slug}`} className="btn">{g.name} accounts</Link>)}
        </div>
      </section>
      {gameRows.length === 0 && <p className="muted">No games yet. Run <code>npm run db:seed</code> or add one in the admin.</p>}
      {latest.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-semibold">Latest listings</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map(({ p, game, stock }) => <ProductCard key={p.id} p={p} stock={stock} defs={game.attributeSchema} />)}
          </div>
        </section>
      )}
    </div>
  );
}
