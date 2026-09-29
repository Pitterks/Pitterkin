import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import { readCartIds } from "@/lib/cart";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Pitterkin · Game accounts", template: "%s · Pitterkin" },
  description: "Verified game accounts with warranty and instant delivery.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cartCount = (await readCartIds()).length;
  const navGames = await db.select({ slug: schema.games.slug, name: schema.games.name }).from(schema.games).where(eq(schema.games.active, true));
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b" style={{ borderColor: "var(--line)" }}>
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-xl font-bold">Pitterkin</Link>
            <nav className="flex gap-5 text-sm muted">
              {navGames.map((g) => <Link key={g.slug} href={`/games/${g.slug}`}>{g.name}</Link>)}
              <Link href="/#warranty">Warranty</Link>
              <Link href="/cart">Cart{cartCount ? ` (${cartCount})` : ""}</Link>
              <Link href="/admin">Admin</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-10 text-sm muted">
          Not affiliated with Epic Games. Instant delivery · replacement warranty on every account.
        </footer>
      </body>
    </html>
  );
}
