import Link from "next/link";
import { and, asc, desc, eq, gte, lte, sql as dsql } from "drizzle-orm";
import { db, schema } from "@/db";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";
const { products, games, inventoryItems } = schema;

type SP = Promise<{ [k: string]: string | undefined }>;

export default async function Home({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const game = (await db.select().from(games).where(eq(games.slug, "fortnite")))[0];
  if (!game) return <p className="muted">Run <code>npm run db:seed</code> to load demo data.</p>;

  const conds = [eq(products.gameId, game.id), eq(products.active, true)];
  const num = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : undefined);
  const minSkins = num(sp.minSkins), maxPrice = num(sp.maxPrice);
  if (minSkins !== undefined) conds.push(gte(dsql`(${products.attributes}->>'skins')::int`, minSkins));
  if (maxPrice !== undefined) conds.push(lte(products.priceCents, maxPrice * 100));
  if (sp.platform) conds.push(eq(dsql`${products.attributes}->>'platform'`, sp.platform));
  if (sp.og === "1") conds.push(eq(dsql`${products.attributes}->>'og'`, "true"));

  const order = sp.sort === "price_desc" ? desc(products.priceCents) : sp.sort === "new" ? desc(products.createdAt) : asc(products.priceCents);

  const rows = await db
    .select({
      p: products,
      stock: dsql<number>`(select count(*)::int from ${inventoryItems} i where i.product_id = products.id and i.status = 'available')`,
    })
    .from(products).where(and(...conds)).orderBy(order);

  const platforms = game.attributeSchema.find((a) => a.key === "platform")?.options ?? [];

  return (
    <div className="grid gap-8 md:grid-cols-[260px_1fr]">
      <form className="card h-fit space-y-4 p-4" method="get">
        <h2 className="font-semibold">Filters</h2>
        <label className="block text-sm">Min skins<input name="minSkins" defaultValue={sp.minSkins} className="input mt-1" inputMode="numeric" /></label>
        <label className="block text-sm">Max price (USD)<input name="maxPrice" defaultValue={sp.maxPrice} className="input mt-1" inputMode="numeric" /></label>
        <label className="block text-sm">Platform
          <select name="platform" defaultValue={sp.platform ?? ""} className="input mt-1">
            <option value="">Any</option>
            {platforms.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="og" value="1" defaultChecked={sp.og === "1"} /> OG accounts only</label>
        <label className="block text-sm">Sort
          <select name="sort" defaultValue={sp.sort ?? ""} className="input mt-1">
            <option value="">Price ↑</option><option value="price_desc">Price ↓</option><option value="new">Newest</option>
          </select>
        </label>
        <button className="btn w-full">Apply</button>
      </form>

      <section>
        <h1 className="mb-1 text-2xl font-bold">Fortnite accounts</h1>
        <p id="warranty" className="muted mb-6 text-sm">Full access · instant delivery after payment · replacement warranty.</p>
        {rows.length === 0 && <p className="muted">Nothing matches these filters.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map(({ p, stock }) => (
            <Link key={p.id} href={`/product/${p.id}`} className="card block p-4 transition hover:-translate-y-0.5">
              <div className="mb-3 flex flex-wrap gap-2 text-xs">
                <span className="btn-ghost">{String(p.attributes.skins ?? "—")} skins</span>
                <span className="btn-ghost">{String(p.attributes.platform ?? "—")}</span>
                {p.attributes.og === true && <span className="btn-ghost">OG</span>}
              </div>
              <h3 className="font-semibold leading-snug">{p.title}</h3>
              <div className="mt-4 flex items-end justify-between">
                <span className="text-xl font-bold">{money(p.priceCents, p.currency)}</span>
                <span className={`text-xs ${stock ? "text-emerald-400" : "text-rose-400"}`}>{stock ? `${stock} in stock` : "Sold out"}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
