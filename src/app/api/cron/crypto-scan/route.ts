import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { cryptoConfig } from "@/lib/payments/crypto/config";
import { jsonRpcClient } from "@/lib/payments/crypto/rpc";
import { scanDeposits } from "@/lib/payments/crypto/scanner";

/** Called by a scheduler (cron / uptime pinger) every ~30-60s. Guarded by CRON_SECRET. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || !safeEqual(given, secret)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const cfg = cryptoConfig();
  if (!cfg) return NextResponse.json({ error: "crypto disabled" }, { status: 400 });
  try {
    return NextResponse.json(await scanDeposits(jsonRpcClient(cfg.rpcUrl), cfg));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
