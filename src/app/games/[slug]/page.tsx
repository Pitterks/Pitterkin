import { notFound } from "next/navigation";
import { and, asc, desc, eq, gte, sql as dsql } from "drizzle-orm";
import { db, schema } from "@/db";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";
const { products, games, inventoryItems } = schema;

type SP = Promise<{ [k: string]: string | undefined }>;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const g = (await db.select().from(games).where(eq(games.slug, (await params).slug)))[0];
  return { title: g ? `${g.name} accounts` : "Not found" };
}

export default async function GamePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: SP }) {
  const { slug } = await params;
  const sp = await searchParams;
  const game = (await db.select().from(games).where(and(eq(games.slug, slug), eq(games.active, true))))[0];
  if (!game) notFound();

  const conds = [eq(products.gameId, game.id), eq(products.active, true)];
  const filterable = game.attributeSchema.filter((a) => a.filterable);
  // keys come from the game's schema (whitelist), values are bound parameters
  for (const a of filterable) {
    if (a.type === "number") {
      const v = sp[`min_${a.key}`];
      if (v && /^\d{1,9}$/.test(v)) conds.push(gte(dsql`(${products.attributes}->>${a.key})::numeric`, Number(v)));
    } else if (a.type === "select") {
      const v = sp[`f_${a.key}`];
      if (v && a.options?.includes(v)) conds.push(eq(dsql`${products.attributes}->>${a.key}`, v));
    } else if (a.type === "boolean" && sp[`f_${a.key}`] === "1") {
      conds.push(eq(dsql`${products.attributes}->>${a.key}`, "true"));
    }
  }
  const maxPrice = sp.maxPrice && /^\d{1,7}$/.test(sp.maxPrice) ? Number(sp.maxPrice) : undefined;
  if (maxPrice !== undefined) conds.push(dsql`${products.priceCents} <= ${maxPrice * 100}`);

  const order = sp.sort === "price_desc" ? desc(products.priceCents) : sp.sort === "new" ? desc(products.createdAt) : asc(products.priceCents);
  const rows = await db
    .select({
      p: products,
      stock: dsql<number>`(select count(*)::int from ${inventoryItems} i where i.product_id = products.id and i.status = 'available')`,
    })
    .from(products).where(and(...conds)).orderBy(order);

  return (
    <div className="grid gap-8 md:grid-cols-[260px_1fr]">
      <form className="card h-fit space-y-4 p-4" method="get">
        <h2 className="font-semibold">Filters</h2>
        {filterable.map((a) => a.type === "number" ? (
          <label key={a.key} className="block text-sm">Min {a.label.toLowerCase()}<input name={`min_${a.key}`} defaultValue={sp[`min_${a.key}`]} className="input mt-1" inputMode="numeric" /></label>
        ) : a.type === "select" ? (
          <label key={a.key} className="block text-sm">{a.label}
            <select name={`f_${a.key}`} defaultValue={sp[`f_${a.key}`] ?? ""} className="input mt-1"><option value="">Any</option>{a.options?.map((o) => <option key={o}>{o}</option>)}</select>
          </label>
        ) : a.type === "boolean" ? (
          <label key={a.key} className="flex items-center gap-2 text-sm"><input type="checkbox" name={`f_${a.key}`} value="1" defaultChecked={sp[`f_${a.key}`] === "1"} />{a.label}</label>
        ) : null)}
        <label className="block text-sm">Max price (USD)<input name="maxPrice" defaultValue={sp.maxPrice} className="input mt-1" inputMode="numeric" /></label>
        <label className="block text-sm">Sort
          <select name="sort" defaultValue={sp.sort ?? ""} className="input mt-1"><option value="">Price ↑</option><option value="price_desc">Price ↓</option><option value="new">Newest</option></select>
        </label>
        <button className="btn w-full">Apply</button>
      </form>

      <section>
        <h1 className="mb-1 text-2xl font-bold">{game.name} accounts</h1>
        <p id="warranty" className="muted mb-6 text-sm">Full access · instant delivery after payment · replacement warranty.</p>
        {rows.length === 0 && <p className="muted">Nothing matches these filters.</p>}
        <div className="grid gap-4 sm:grid-cols-2">{rows.map(({ p, stock }) => <ProductCard key={p.id} p={p} stock={stock} defs={game.attributeSchema} />)}</div>
      </section>
    </div>
  );
}
