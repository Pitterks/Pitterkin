"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createOrder, OrderError } from "@/lib/orders";
import { rateLimit } from "@/lib/ratelimit";

const schemaIn = z.object({
  productId: z.string().uuid(),
  email: z.string().email().max(200),
  provider: z.string().max(40),
  terms: z.literal("on"),
});

export async function placeOrder(form: FormData) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const parsed = schemaIn.safeParse(Object.fromEntries(form));
  const back = (msg: string) => redirect(`/product/${form.get("productId")}?error=${encodeURIComponent(msg)}`);
  if (!parsed.success) return back("Please check the form and accept the terms.");
  if (!rateLimit(`order:${ip ?? parsed.data.email}`, 5, 10 * 60_000)) return back("Too many attempts, try again later.");

  let target: string;
  try {
    const { order, redirectUrl } = await createOrder({
      email: parsed.data.email, providerId: parsed.data.provider, ip,
      lines: [{ productId: parsed.data.productId, qty: 1 }],
    });
    target = `${redirectUrl}${redirectUrl.includes("?") ? "&" : "?"}token=${order.accessToken}`;
  } catch (e) {
    if (e instanceof OrderError) return back(e.message);
    throw e;
  }
  redirect(target);
}
