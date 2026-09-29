import Link from "next/link";
import type { products, AttributeDef } from "@/db/schema";
import { money } from "@/lib/format";

type Product = typeof products.$inferSelect;

export function ProductCard({ p, stock, defs }: { p: Product; stock: number; defs: AttributeDef[] }) {
  // show up to 3 attributes as chips, straight from the game's schema
  const chips = defs.flatMap((d) => {
    const v = p.attributes[d.key];
    if (v === undefined || v === false) return [];
    return [v === true ? d.label : d.type === "number" ? `${v} ${d.label.toLowerCase()}` : String(v)];
  }).slice(0, 3);
  return (
    <Link href={`/product/${p.id}`} className="card block p-4 transition hover:-translate-y-0.5">
      <div className="mb-3 flex flex-wrap gap-2 text-xs">{chips.map((c) => <span key={c} className="btn-ghost">{c}</span>)}</div>
      <h3 className="font-semibold leading-snug">{p.title}</h3>
      <div className="mt-4 flex items-end justify-between">
        <span className="text-xl font-bold">{money(p.priceCents, p.currency)}</span>
        <span className={`text-xs ${stock ? "text-emerald-400" : "text-rose-400"}`}>{stock ? `${stock} in stock` : "Sold out"}</span>
      </div>
    </Link>
  );
}
