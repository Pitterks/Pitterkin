import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";
import { ProductForm } from "@/components/ProductForm";
import { saveProduct } from "@/lib/product-actions";
import { parseDraft } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function NewProduct({ searchParams }: { searchParams: Promise<{ error?: string; game?: string; draft?: string }> }) {
  await requireAdmin();
  const { error, game, draft } = await searchParams;
  const gamesList = await db.select().from(schema.games);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">New product</h1>
      {gamesList.length > 1 && (
        <div className="flex gap-2 text-sm">{gamesList.map((g) => <a key={g.id} href={`/admin/products/new?game=${g.id}`} className="btn-ghost">{g.name}</a>)}</div>
      )}
      {gamesList.length ? <ProductForm action={saveProduct} gamesList={gamesList} error={error} selectedGameId={game} draft={parseDraft(draft)} /> : <p className="muted">Create a game first.</p>}
    </div>
  );
}
