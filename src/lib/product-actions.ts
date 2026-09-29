"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";
import { parseAttributes, parseImages, productSchema } from "@/lib/catalog";

export async function saveProduct(form: FormData) {
  await requireAdmin();
  const id = form.get("id") ? String(form.get("id")) : null;
  const back = (e: string) => {
    const draft: Record<string, string> = {};
    for (const [k, v] of form.entries()) if (typeof v === "string" && k !== "id" && !k.startsWith("$ACTION")) draft[k] = v.slice(0, 5000);
    const q = new URLSearchParams({ error: e, game: String(form.get("gameId") ?? ""), draft: Buffer.from(JSON.stringify(draft)).toString("base64url") });
    return redirect(`${id ? `/admin/products/${id}` : "/admin/products/new"}?${q}`);
  };

  const parsed = productSchema.safeParse({
    gameId: form.get("gameId"), title: form.get("title"), description: form.get("description") ?? "",
    priceUsd: form.get("priceUsd"), warrantyDays: form.get("warrantyDays"), active: form.get("active") === "on",
    images: parseImages(form.get("images")),
  });
  if (!parsed.success) return back(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));

  const game = (await db.select().from(schema.games).where(eq(schema.games.id, parsed.data.gameId)))[0];
  if (!game) return back("Unknown game");
  let attributes;
  try { attributes = parseAttributes(game.attributeSchema, form); } catch (e) { return back((e as Error).message); }

  const values = {
    gameId: game.id, title: parsed.data.title, description: parsed.data.description,
    priceCents: Math.round(parsed.data.priceUsd * 100), warrantyDays: parsed.data.warrantyDays,
    active: parsed.data.active, images: parsed.data.images, attributes,
  };
  await db.transaction(async (tx) => {
    const pid = id
      ? (await tx.update(schema.products).set(values).where(eq(schema.products.id, id)).returning({ id: schema.products.id }))[0]?.id
      : (await tx.insert(schema.products).values(values).returning({ id: schema.products.id }))[0].id;
    await tx.insert(schema.auditLog).values({ actor: "admin", action: id ? "product_updated" : "product_created", target: pid });
  });
  revalidatePath("/"); revalidatePath("/admin/products");
  redirect("/admin/products");
}
