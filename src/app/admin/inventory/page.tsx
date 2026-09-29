import { eq, sql as dsql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";
import { encrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";
const { products, inventoryItems, auditLog } = schema;

const importSchema = z.object({
  productId: z.string().uuid(),
  supplier: z.string().max(80).optional(),
  costUsd: z.coerce.number().min(0).max(100000).optional(),
});

/** One account per blank-line-separated block, e.g. "email:pass". Stored encrypted. */
async function importAccounts(form: FormData) {
  "use server";
  await requireAdmin();
  const p = importSchema.parse(Object.fromEntries(form));
  const blocks = String(form.get("accounts") ?? "").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  if (!blocks.length || blocks.length > 500) return;
  await db.insert(inventoryItems).values(blocks.map((b) => ({
    productId: p.productId, credentialsEnc: encrypt(b), supplier: p.supplier || null,
    costCents: p.costUsd !== undefined ? Math.round(p.costUsd * 100) : null,
  })));
  await db.insert(auditLog).values({ actor: "admin", action: "inventory_import", target: p.productId, meta: { count: blocks.length } });
  revalidatePath("/admin/inventory");
}

export default async function AdminInventory() {
  await requireAdmin();
  const rows = await db
    .select({
      p: products,
      available: dsql<number>`count(*) filter (where ${inventoryItems.status} = 'available')::int`,
      sold: dsql<number>`count(*) filter (where ${inventoryItems.status} = 'sold')::int`,
    })
    .from(products).leftJoin(inventoryItems, eq(inventoryItems.productId, products.id)).groupBy(products.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Inventory</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="muted"><tr><th className="p-3">Product</th><th>Available</th><th>Sold</th></tr></thead>
          <tbody>{rows.map(({ p, available, sold }) => (
            <tr key={p.id} className="border-t" style={{ borderColor: "var(--line)" }}>
              <td className="p-3">{p.title}</td><td>{available}</td><td>{sold}</td>
            </tr>))}
          </tbody>
        </table>
      </div>

      <form action={importAccounts} className="card space-y-3 p-4">
        <h2 className="font-semibold">Bulk import accounts</h2>
        <select name="productId" className="input" required>{rows.map(({ p }) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
        <div className="grid grid-cols-2 gap-3">
          <input name="supplier" className="input" placeholder="Supplier" />
          <input name="costUsd" className="input" placeholder="Cost per account, USD" inputMode="decimal" />
        </div>
        <textarea name="accounts" rows={8} required className="input font-mono" placeholder={"email1@x.com:password1\n\nemail2@x.com:password2"} />
        <p className="muted text-xs">Separate accounts with a blank line. Data is encrypted before it reaches the database.</p>
        <button className="btn">Import</button>
      </form>
    </div>
  );
}
