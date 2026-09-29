import { notFound } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { cryptoConfig } from "@/lib/payments/crypto/config";
import { receivedCents } from "@/lib/payments/crypto/scanner";
import { AutoRefresh } from "@/components/AutoRefresh";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pay with crypto", robots: { index: false } };

export default async function CryptoPay({ params, searchParams }: { params: Promise<{ ext: string }>; searchParams: Promise<{ token?: string }> }) {
  const cfg = cryptoConfig();
  const { ext } = await params;
  const { token } = await searchParams;
  if (!cfg || !token || !/^crypto_[0-9a-f-]{36}$/.test(ext)) notFound();

  const row = (await db
    .select({ d: schema.cryptoDeposits, orderId: schema.orders.id, accessToken: schema.orders.accessToken, status: schema.orders.status })
    .from(schema.cryptoDeposits)
    .innerJoin(schema.payments, eq(schema.payments.externalId, schema.cryptoDeposits.externalId))
    .innerJoin(schema.orders, eq(schema.orders.id, schema.payments.orderId))
    .where(eq(schema.cryptoDeposits.externalId, ext)))[0];
  if (!row || row.accessToken !== token) notFound();

  const got = await receivedCents(ext);
  const remaining = Math.max(0, row.d.expectedCents - got);
  const qr = await QRCode.toString(row.d.address, { type: "svg", margin: 1, color: { dark: "#0b0d12", light: "#ffffff" } });
  const done = row.status === "delivered";

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {!done && <AutoRefresh ms={10000} />}
      <h1 className="text-2xl font-bold">Pay with crypto</h1>
      <div className="card space-y-4 p-5">
        <div className="flex justify-between"><span className="muted">Amount due</span><b>{money(row.d.expectedCents)}</b></div>
        {got > 0 && <div className="flex justify-between text-sm"><span className="muted">Received (awaiting confirmations counts once final)</span><span>{money(got)}</span></div>}
        {!done && remaining > 0 && (
          <p className="rounded-lg bg-white/5 p-3 text-sm">
            Send <b>{(remaining / 100).toFixed(2)}</b> of {cfg.tokens.map((t) => t.symbol).join(" or ")} on <b>{cfg.chainName}</b> to:
          </p>
        )}
        {!done && (
          <>
            <div className="mx-auto w-44 rounded-lg bg-white p-2" dangerouslySetInnerHTML={{ __html: qr }} />
            <code className="block break-all rounded-lg bg-black/40 p-3 text-center text-sm">{row.d.address}</code>
            <ul className="muted list-disc space-y-1 pl-5 text-xs">
              <li>Only the <b>{cfg.chainName}</b> network. Funds sent on another network are lost.</li>
              <li>This address is unique to your order. Sending less? Just send the difference to the same address.</li>
              <li>The order completes automatically after ~{cfg.confirmations} network confirmations (usually 1–2 minutes).</li>
            </ul>
          </>
        )}
        {!done && (
          <details className="rounded-lg border p-3 text-sm" style={{ borderColor: "var(--line)" }}>
            <summary className="cursor-pointer font-medium">No crypto yet? Pay with a card</summary>
            <ol className="muted mt-2 list-decimal space-y-1 pl-5 text-xs">
              <li>Buy USDC or USDT with your card on any exchange or wallet app you trust (Coinbase, Binance, Kraken, MoonPay, etc.).</li>
              <li>Withdraw / send it to the address above and select the <b>{cfg.chainName}</b> network.</li>
              <li>Send the amount shown (exchange withdrawal fees are paid on top). This page updates automatically.</li>
            </ol>
            <p className="muted mt-2 text-xs">Card purchases and their fees are handled by the service you choose, not by us.</p>
          </details>
        )}
        <Link className="btn block text-center" href={`/order/${row.orderId}?token=${token}`}>{done ? "View your account" : "Go to order page"}</Link>
      </div>
    </div>
  );
}
