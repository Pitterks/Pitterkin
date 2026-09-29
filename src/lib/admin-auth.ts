import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { safeEqual, sign } from "./crypto";

const COOKIE = "admin_session";
const TTL_MS = 8 * 3600_000;

export function checkPassword(input: string): boolean {
  return safeEqual(sign(input), sign(process.env.ADMIN_PASSWORD ?? "\0none"));
}

export async function startSession() {
  const exp = String(Date.now() + TTL_MS);
  (await cookies()).set(COOKIE, `${exp}.${sign(`admin:${exp}`)}`, {
    httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/admin", maxAge: TTL_MS / 1000,
  });
}

export async function endSession() {
  (await cookies()).delete({ name: COOKIE, path: "/admin" });
}

export async function isAdmin(): Promise<boolean> {
  const v = (await cookies()).get(COOKIE)?.value;
  if (!v) return false;
  const [exp, mac] = v.split(".");
  return !!exp && !!mac && Number(exp) > Date.now() && safeEqual(mac, sign(`admin:${exp}`));
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}
