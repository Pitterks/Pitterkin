import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { checkPassword, startSession } from "@/lib/admin-auth";
import { rateLimit } from "@/lib/ratelimit";
import { verifyTotp } from "@/lib/totp";

const totpSecret = () => process.env.ADMIN_TOTP_SECRET || null;
const usedCodes = new Set<string>();

async function login(form: FormData) {
  "use server";
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!rateLimit(`login:${ip}`, 5, 15 * 60_000)) redirect("/admin/login?e=rate");
  if (!checkPassword(String(form.get("password") ?? ""))) redirect("/admin/login?e=bad");
  const secret = totpSecret();
  if (secret) {
    const code = String(form.get("code") ?? "").trim();
    // a code is single-use: a shoulder-surfed or replayed code cannot be reused inside its window
    if (!verifyTotp(secret, code) || usedCodes.has(code)) redirect("/admin/login?e=bad");
    usedCodes.add(code);
    setTimeout(() => usedCodes.delete(code), 120_000).unref?.();
  }
  await startSession();
  redirect("/admin");
}

export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <form action={login} className="card mx-auto max-w-sm space-y-4 p-6">
      <h1 className="text-xl font-bold">Admin</h1>
      {e && <p className="text-sm text-rose-300">{e === "rate" ? "Too many attempts." : "Wrong password or code."}</p>}
      <input name="password" type="password" className="input" placeholder="Password" autoFocus required />
      {totpSecret() && <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} className="input" placeholder="6-digit code" required />}
      <button className="btn w-full">Sign in</button>
    </form>
  );
}
