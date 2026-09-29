import type { AttributeDef, games, products } from "@/db/schema";

type Game = typeof games.$inferSelect;
type Product = typeof products.$inferSelect;

/** Server-rendered form; attribute inputs are generated from the game's schema. */
export function ProductForm({ action, gamesList, product, error, selectedGameId, draft }: {
  action: (form: FormData) => Promise<void>; gamesList: Game[]; product?: Product; error?: string; selectedGameId?: string; draft?: Record<string, string>;
}) {
    const game = gamesList.find((g) => g.id === (product?.gameId ?? selectedGameId)) ?? gamesList[0];
  const field = (d: AttributeDef) => {
    const name = `attr_${d.key}`;
    const v = draft ? (d.type === "boolean" ? draft[name] === "on" : draft[name]) : product?.attributes[d.key];
    if (d.type === "boolean") return <label key={d.key} className="flex items-center gap-2 text-sm"><input type="checkbox" name={name} defaultChecked={v === true} />{d.label}</label>;
    if (d.type === "select") return (
      <label key={d.key} className="block text-sm">{d.label}
        <select name={name} defaultValue={String(v ?? "")} className="input mt-1"><option value="">—</option>{d.options?.map((o) => <option key={o}>{o}</option>)}</select>
      </label>);
    return <label key={d.key} className="block text-sm">{d.label}<input name={name} defaultValue={v === undefined ? "" : String(v)} inputMode={d.type === "number" ? "numeric" : undefined} className="input mt-1" /></label>;
  };
  return (
    <form action={action} className="card space-y-4 p-4">
      {error && <p className="rounded-lg bg-rose-500/10 p-2 text-sm text-rose-300">{error}</p>}
      {product && <input type="hidden" name="id" value={product.id} />}
      <input type="hidden" name="gameId" value={game?.id} />
      <p className="text-sm"><span className="muted">Game:</span> <b>{game?.name}</b></p>
      <label className="block text-sm">Title<input name="title" required defaultValue={draft ? draft.title : product?.title} className="input mt-1" /></label>
      <label className="block text-sm">Description<textarea name="description" rows={4} defaultValue={draft ? draft.description : product?.description} className="input mt-1" /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">Price (USD)<input name="priceUsd" required inputMode="decimal" defaultValue={draft ? draft.priceUsd : product ? (product.priceCents / 100).toFixed(2) : ""} className="input mt-1" /></label>
        <label className="block text-sm">Warranty (days)<input name="warrantyDays" required inputMode="numeric" defaultValue={draft ? draft.warrantyDays : product?.warrantyDays ?? 7} className="input mt-1" /></label>
      </div>
      <fieldset className="grid grid-cols-2 gap-3 border-t pt-3" style={{ borderColor: "var(--line)" }}>
        <legend className="muted px-1 text-xs">Attributes ({game?.name})</legend>
        {game?.attributeSchema.map(field)}
      </fieldset>
      <label className="block text-sm">Image URLs (https, one per line)<textarea name="images" rows={3} defaultValue={draft ? draft.images : product?.images.join("\n")} className="input mt-1 font-mono" /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={draft ? draft.active === "on" : product?.active ?? true} />Visible in the store</label>
      <button className="btn">{product ? "Save changes" : "Create product"}</button>
    </form>
  );
}
