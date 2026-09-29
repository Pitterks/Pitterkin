import Link from "next/link";
import { cartProducts } from "@/lib/cart";
import { money } from "@/lib/format";
import { providers } from "@/lib/payments";
import { removeFromCart } from "./actions";
import { checkoutCart } from "../checkout/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cart" };

export default async function Cart({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const items = await cartProducts();
  const total = items.reduce((s, p) => s + p.priceCents, 0);

  if (!items.length) return (
    <div className="card p-8 text-center"><p className="muted mb-4">Your cart is empty.</p><Link className="btn inline-block" href="/">Browse accounts</Link></div>
  );
  return (
    <div className="grid gap-8 md:grid-cols-[1fr_340px]">
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Cart</h1>
        {items.map((p) => (
          <div key={p.id} className="card flex items-center justify-between gap-4 p-4">
            <Link href={`/product/${p.id}`} className="font-medium">{p.title}</Link>
            <div className="flex items-center gap-4">
              <span className="font-semibold">{money(p.priceCents, p.currency)}</span>
              <form action={removeFromCart}><input type="hidden" name="productId" value={p.id} /><button className="btn-ghost text-sm">Remove</button></form>
            </div>
          </div>
        ))}
      </div>
      <form action={checkoutCart} className="card h-fit space-y-4 p-4">
        <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{money(total)}</span></div>
        {error && <p className="rounded-lg bg-rose-500/10 p-2 text-sm text-rose-300">{error}</p>}
        <label className="block text-sm">Email for delivery<input name="email" type="email" required className="input mt-1" /></label>
        <label className="block text-sm">Payment method
          <select name="provider" className="input mt-1">{providers().map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
        </label>
        <label className="flex items-start gap-2 text-xs muted"><input type="checkbox" name="terms" required className="mt-0.5" />I agree to the terms and warranty conditions.</label>
        <button className="btn w-full">Pay {money(total)}</button>
      </form>
    </div>
  );
}
