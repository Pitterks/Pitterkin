import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";
import { attributeSchemaJson } from "@/lib/catalog";

export const dynamic = "force-dynamic";

const gameInput = z.object({ name: z.string().trim().min(2).max(60), slug: z.string().regex(/^[a-z0-9-]{2,40}$/), attributes: attributeSchemaJson });

async function createGame(form: FormData) {
  "use server";
  await requireAdmin();
  const p = gameInput.safeParse({ name: form.get("name"), slug: form.get("slug"), attributes: String(form.get("attributes") || "[]") });
  if (!p.success) redirect(`/admin/games?error=${encodeURIComponent(p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "))}`);
  try {
    await db.insert(schema.games).values({ name: p.data.name, slug: p.data.slug, attributeSchema: p.data.attributes });
  } catch {
    redirect("/admin/games?error=Slug%20already%20exists");
  }
  revalidatePath("/admin/games");
  redirect("/admin/games");
}

export default async function AdminGames({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const { error } = await searchParams;
  const rows = await db.select().from(schema.games);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Games</h1>
      <div className="card p-4"><ul className="space-y-1 text-sm">{rows.map((g) => <li key={g.id}><b>{g.name}</b> <span className="muted">/{g.slug} · {g.attributeSchema.length} attributes</span></li>)}</ul></div>
      <form action={createGame} className="card space-y-3 p-4">
        <h2 className="font-semibold">Add a game</h2>
        {error && <p className="rounded-lg bg-rose-500/10 p-2 text-sm text-rose-300">{error}</p>}
        <div className="grid grid-cols-2 gap-3"><input name="name" required className="input" placeholder="Name" /><input name="slug" required className="input" placeholder="slug (a-z, 0-9, -)" /></div>
        <textarea name="attributes" rows={7} className="input font-mono" defaultValue={'[\n  { "key": "rank", "label": "Rank", "type": "select", "options": ["Bronze", "Silver", "Gold"], "filterable": true }\n]'} />
        <p className="muted text-xs">Attribute types: number, text, select (needs options), boolean.</p>
        <button className="btn">Create game</button>
      </form>
    </div>
  );
}
