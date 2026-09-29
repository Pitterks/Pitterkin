import { notFound } from "next/navigation";
import { eq, and, sql as dsql } from "drizzle-orm";
import { db, schema } from "@/db";
import { money } from "@/lib/format";
import { providers } from "@/lib/payments";
import { placeOrder } from "../../checkout/actions";

export const dynamic = "force-dynamic";
const { products, games, inventoryItems } = schema;

export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const row = (await db.select({ p: products, g: games }).from(products).innerJoin(games, eq(games.id, products.gameId)).where(and(eq(products.id, id), eq(products.active, true))))[0];
  if (!row) notFound();
  const { p, g } = row;
  const stock = (await db.select({ n: dsql<number>`count(*)::int` }).from(inventoryItems).where(and(eq(inventoryItems.productId, id), eq(inventoryItems.status, "available"))))[0].n;
  const methods = providers();

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_360px]">
      <div>
        <p className="muted text-sm">{g.name}</p>
        <h1 className="mb-4 text-2xl font-bold">{p.title}</h1>
        <p className="mb-6">{p.description}</p>
        <div className="card p-4">
          <h2 className="mb-3 font-semibold">Details</h2>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            {g.attributeSchema.map((a) => {
              const v = p.attributes[a.key];
              return (
                <div key={a.key} className="contents">
                  <dt className="muted">{a.label}</dt>
                  <dd>{typeof v === "boolean" ? (v ? "Yes" : "No") : String(v ?? "—")}</dd>
                </div>
              );
            })}
            <dt className="muted">Warranty</dt><dd>{p.warrantyDays} days</dd>
          </dl>
        </div>
      </div>

      <form action={placeOrder} className="card h-fit space-y-4 p-4">
        <input type="hidden" name="productId" value={p.id} />
        <div className="text-3xl font-bold">{money(p.priceCents, p.currency)}</div>
        <div className={`text-sm ${stock ? "text-emerald-400" : "text-rose-400"}`}>{stock ? `${stock} in stock` : "Sold out"}</div>
        {error && <p className="rounded-lg bg-rose-500/10 p-2 text-sm text-rose-300">{error}</p>}
        <label className="block text-sm">Email for delivery
          <input name="email" type="email" required className="input mt-1" placeholder="you@example.com" />
        </label>
        <label className="block text-sm">Payment method
          <select name="provider" className="input mt-1">{methods.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
        </label>
        <label className="flex items-start gap-2 text-xs muted">
          <input type="checkbox" name="terms" required className="mt-0.5" />
          I agree to the terms and understand the warranty conditions.
        </label>
        <button className="btn w-full disabled:opacity-40" disabled={!stock}>Buy now</button>
      </form>
    </div>
  );
}
