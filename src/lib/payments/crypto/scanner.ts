import { and, eq, gt, inArray, sql as dsql } from "drizzle-orm";
import { db, schema } from "@/db";
import { handlePaymentEvent } from "@/lib/orders";
import type { CryptoConfig } from "./config";
import type { RpcClient } from "./rpc";

const { cryptoDeposits, cryptoTransfers, chainCursors, payments, auditLog } = schema;

// keccak256("Transfer(address,address,uint256)")
export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const BLOCK_CHUNK = 2000;
const ADDRESS_BATCH = 40;
const WATCH_HOURS = 72;

const topicOf = (address: string) => "0x" + address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
const addressOf = (topic: string) => "0x" + topic.slice(-40).toLowerCase();

export type ScanResult = { scannedTo: number | null; newTransfers: number; paid: number };

/**
 * One pass: read confirmed ERC-20 Transfer logs to every open deposit address,
 * store them idempotently, and settle payments whose received total is enough.
 * Safe to run repeatedly, concurrently or after downtime (cursor-based).
 */
export async function scanDeposits(rpc: RpcClient, cfg: CryptoConfig): Promise<ScanResult> {
  const open = await db
    .select({ externalId: cryptoDeposits.externalId, address: cryptoDeposits.address })
    .from(cryptoDeposits)
    .innerJoin(payments, and(eq(payments.externalId, cryptoDeposits.externalId), eq(payments.provider, "crypto")))
    .where(and(
      eq(cryptoDeposits.chainId, cfg.chainId),
      eq(payments.status, "created"),
      gt(cryptoDeposits.createdAt, dsql`now() - make_interval(hours => ${WATCH_HOURS})`),
    ));
  if (!open.length) return { scannedTo: null, newTransfers: 0, paid: 0 };

  const latest = await rpc.blockNumber();
  const safe = latest - cfg.confirmations;
  const cursor = (await db.select().from(chainCursors).where(eq(chainCursors.chainId, cfg.chainId)))[0];
  const from0 = cursor ? cursor.lastBlock + 1 : Math.max(0, safe - cfg.lookbackBlocks);
  if (from0 > safe) return { scannedTo: cursor?.lastBlock ?? null, newTransfers: 0, paid: 0 };

  const byAddress = new Map(open.map((d) => [d.address.toLowerCase(), d.externalId]));
  const addresses = [...byAddress.keys()];
  const touched = new Set<string>();
  let newTransfers = 0;

  for (let from = from0; from <= safe; from += BLOCK_CHUNK) {
    const to = Math.min(from + BLOCK_CHUNK - 1, safe);
    for (const token of cfg.tokens) {
      for (let i = 0; i < addresses.length; i += ADDRESS_BATCH) {
        const batch = addresses.slice(i, i + ADDRESS_BATCH);
        const logs = await rpc.getLogs({
          address: token.address, fromBlock: from, toBlock: to,
          topics: [TRANSFER_TOPIC, null, batch.map(topicOf)],
        });
        for (const log of logs) {
          if (log.address.toLowerCase() !== token.address.toLowerCase() || log.topics[0] !== TRANSFER_TOPIC || log.topics.length !== 3) continue;
          const externalId = byAddress.get(addressOf(log.topics[2]));
          if (!externalId) continue;
          const raw = BigInt(log.data);
          const cents = Number(raw / 10n ** BigInt(token.decimals - 2));
          const ins = await db.insert(cryptoTransfers).values({
            chainId: cfg.chainId, txHash: log.transactionHash.toLowerCase(), logIndex: log.logIndex, externalId,
            token: token.symbol, amountRaw: raw.toString(), amountCents: cents, blockNumber: log.blockNumber,
          }).onConflictDoNothing().returning({ id: cryptoTransfers.id });
          if (ins.length) { newTransfers++; touched.add(externalId); }
        }
      }
    }
    // advance only after the whole chunk succeeded; a failure retries the same range
    await db.insert(chainCursors).values({ chainId: cfg.chainId, lastBlock: to })
      .onConflictDoUpdate({ target: chainCursors.chainId, set: { lastBlock: to } });
  }

  // settle everything that has funds and is still unpaid (covers top-ups across runs)
  const withFunds = await db.selectDistinct({ externalId: cryptoTransfers.externalId }).from(cryptoTransfers)
    .where(inArray(cryptoTransfers.externalId, open.map((o) => o.externalId)));
  withFunds.forEach((r) => touched.add(r.externalId));

  let paid = 0;
  for (const externalId of touched) if ((await settle(cfg, externalId)) === "delivered") paid++;
  return { scannedTo: safe, newTransfers, paid };
}

export async function receivedCents(externalId: string): Promise<number> {
  const r = await db.select({ s: dsql<number>`coalesce(sum(${cryptoTransfers.amountCents}), 0)::int` })
    .from(cryptoTransfers).where(eq(cryptoTransfers.externalId, externalId));
  return r[0].s;
}

async function settle(cfg: CryptoConfig, externalId: string) {
  const dep = (await db.select().from(cryptoDeposits).where(eq(cryptoDeposits.externalId, externalId)))[0];
  if (!dep) return null;
  const got = await receivedCents(externalId);
  const min = Math.floor(dep.expectedCents * (1 - cfg.toleranceBps / 10_000));
  if (got < min) return "underpaid" as const;

  const outcome = await handlePaymentEvent("crypto", {
    externalId, status: "paid", amountCents: dep.expectedCents, raw: { receivedCents: got },
  });
  if (outcome === "delivered" || outcome === "needs_manual") {
    if (got > dep.expectedCents + Math.ceil(dep.expectedCents * (cfg.toleranceBps / 10_000))) {
      await db.insert(auditLog).values({
        actor: "crypto-scanner", action: "crypto_overpaid", target: externalId,
        meta: { expectedCents: dep.expectedCents, receivedCents: got },
      });
    }
  }
  return outcome;
}
