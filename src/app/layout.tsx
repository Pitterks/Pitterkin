import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Pitterkin · Game accounts", template: "%s · Pitterkin" },
  description: "Verified game accounts with warranty and instant delivery.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b" style={{ borderColor: "var(--line)" }}>
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-xl font-bold">Pitterkin</Link>
            <nav className="flex gap-5 text-sm muted">
              <Link href="/">Accounts</Link>
              <Link href="/#warranty">Warranty</Link>
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
