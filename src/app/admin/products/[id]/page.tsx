import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";
import { ProductForm } from "@/components/ProductForm";
import { saveProduct } from "@/lib/product-actions";
import { parseDraft } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; draft?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { error, draft } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const product = (await db.select().from(schema.products).where(eq(schema.products.id, id)))[0];
  if (!product) notFound();
  const gamesList = await db.select().from(schema.games);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Edit product</h1>
      <ProductForm action={saveProduct} gamesList={gamesList} product={product} error={error} draft={parseDraft(draft)} />
    </div>
  );
}
