import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { checkPassword, startSession } from "@/lib/admin-auth";
import { rateLimit } from "@/lib/ratelimit";

async function login(form: FormData) {
  "use server";
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!rateLimit(`login:${ip}`, 5, 15 * 60_000)) redirect("/admin/login?e=rate");
  if (!checkPassword(String(form.get("password") ?? ""))) redirect("/admin/login?e=bad");
  await startSession();
  redirect("/admin");
}

export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <form action={login} className="card mx-auto max-w-sm space-y-4 p-6">
      <h1 className="text-xl font-bold">Admin</h1>
      {e && <p className="text-sm text-rose-300">{e === "rate" ? "Too many attempts." : "Wrong password."}</p>}
      <input name="password" type="password" className="input" placeholder="Password" autoFocus required />
      <button className="btn w-full">Sign in</button>
    </form>
  );
}
