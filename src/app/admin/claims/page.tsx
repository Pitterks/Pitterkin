import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";
import { replaceAccount, rejectClaim } from "@/lib/warranty";

export const dynamic = "force-dynamic";
const { warrantyClaims, orderItems, orders, products } = schema;

async function replace(form: FormData) {
  "use server";
  await requireAdmin();
  const r = await replaceAccount(String(form.get("id")));
  revalidatePath("/admin/claims");
  if (r === "no_stock") throw new Error("No replacement in stock for this product");
}

async function reject(form: FormData) {
  "use server";
  await requireAdmin();
  await rejectClaim(String(form.get("id")), String(form.get("note") ?? "Claim rejected."));
  revalidatePath("/admin/claims");
}

export default async function AdminClaims() {
  await requireAdmin();
  const rows = await db
    .select({ c: warrantyClaims, email: orders.email, title: products.title, orderId: orders.id })
    .from(warrantyClaims)
    .innerJoin(orderItems, eq(orderItems.id, warrantyClaims.orderItemId))
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(products, eq(products.id, orderItems.productId))
    .orderBy(desc(warrantyClaims.createdAt)).limit(100);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Warranty claims</h1>
      {rows.length === 0 && <p className="muted">No claims yet.</p>}
      {rows.map(({ c, email, title, orderId }) => (
        <div key={c.id} className="card space-y-2 p-4">
          <div className="flex justify-between text-sm"><span className="font-semibold">{title}</span><span className="muted">{c.status} · {c.createdAt.toLocaleString("en-GB")}</span></div>
          <p className="muted text-xs">{email} · order {orderId.slice(0, 8)}</p>
          <p className="whitespace-pre-wrap text-sm">{c.reason}</p>
          {c.adminNote && <p className="muted text-xs">Note: {c.adminNote}</p>}
          {c.status === "open" && (
            <div className="flex flex-wrap gap-2 pt-1">
              <form action={replace}><input type="hidden" name="id" value={c.id} /><button className="btn">Replace account</button></form>
              <form action={reject} className="flex gap-2"><input type="hidden" name="id" value={c.id} /><input name="note" className="input" placeholder="Reason for rejection" required /><button className="btn-ghost">Reject</button></form>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
