import { cookies } from "next/headers";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/db";

const KEY = "cart";
const MAX_LINES = 10;

/** Cart = list of product ids (each line qty 1: accounts are unique goods). Stored in an httpOnly cookie. */
export async function readCartIds(): Promise<string[]> {
  try {
    const raw = (await cookies()).get(KEY)?.value;
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/.test(x)).slice(0, MAX_LINES) : [];
  } catch {
    return [];
  }
}

export async function writeCartIds(ids: string[]) {
  (await cookies()).set(KEY, JSON.stringify([...new Set(ids)].slice(0, MAX_LINES)), {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 86400, secure: process.env.NODE_ENV === "production",
  });
}

export async function cartProducts() {
  const ids = await readCartIds();
  if (!ids.length) return [];
  return db.select().from(schema.products).where(inArray(schema.products.id, ids));
}
