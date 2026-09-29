"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readCartIds, writeCartIds } from "@/lib/cart";

export async function addToCart(form: FormData) {
  const id = String(form.get("productId"));
  if (/^[0-9a-f-]{36}$/.test(id)) await writeCartIds([...(await readCartIds()), id]);
  redirect("/cart");
}

export async function removeFromCart(form: FormData) {
  const id = String(form.get("productId"));
  await writeCartIds((await readCartIds()).filter((x) => x !== id));
  revalidatePath("/cart");
}
