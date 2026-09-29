import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql as dsql } from "drizzle-orm";
import { HDNodeWallet } from "ethers";
import { db, sql, schema } from "@/db";
import { encrypt } from "@/lib/crypto";
import { createOrder, getOrderForCustomer } from "@/lib/orders";
import { cryptoProvider } from "@/lib/payments/crypto/provider";
import { deriveAddress } from "@/lib/payments/crypto/wallet";
import { scanDeposits, TRANSFER_TOPIC } from "@/lib/payments/crypto/scanner";
import type { CryptoConfig } from "@/lib/payments/crypto/config";
import type { Log, RpcClient } from "@/lib/payments/crypto/rpc";

const seed = HDNodeWallet.fromPhrase("test test test test test test test test test test test junk", undefined, "m/44'/60'/0'/0");
const XPUB = seed.neuter().extendedKey;
const USDC = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
const USDT = "0xc2132D05D31c914a87C6611C10748AEb04B58e0e";
const cfg: CryptoConfig = {
  chainId: 137, chainName: "Polygon", rpcUrl: "", xpub: XPUB, confirmations: 10, toleranceBps: 50, lookbackBlocks: 100, explorerTx: "",
  tokens: [{ symbol: "USDC", address: USDC, decimals: 6 }, { symbol: "USDT", address: USDT, decimals: 6 }],
};

/** Fake chain: tests append transfers; getLogs filters like a real node. */
function fakeChain() {
  const logs: Log[] = [];
  let head = 1000;
  let nonce = 0;
  const pad = (a: string) => "0x" + a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const rpc: RpcClient = {
    async blockNumber() { return head; },
    async getLogs(f) {
      const tos = (f.topics[2] as string[]).map((t) => t.toLowerCase());
      return logs.filter((l) => l.address.toLowerCase() === f.address.toLowerCase() && l.blockNumber >= f.fromBlock && l.blockNumber <= f.toBlock
        && l.topics[0] === f.topics[0] && tos.includes(l.topics[2].toLowerCase()));
    },
  };
  return {
    rpc,
    mine: (n: number) => { head += n; },
    transfer(token: string, to: string, units: number, opts: { dup?: Log } = {}) {
      const l: Log = opts.dup ?? {
        address: token, topics: [TRANSFER_TOPIC, pad("0x" + "ab".repeat(20)), pad(to)],
        data: "0x" + BigInt(Math.round(units * 1e6)).toString(16), blockNumber: head, transactionHash: "0x" + (++nonce).toString(16).padStart(64, "0"), logIndex: 0,
      };
      logs.push(l);
      return l;
    },
  };
}

process.env.CRYPTO_XPUB = XPUB;

async function newOrder(priceCents = 1900) {
  await db.execute(dsql`TRUNCATE chain_cursors, crypto_transfers, crypto_deposits, email_outbox, warranty_claims, audit_log, payments, order_items, orders, inventory_items, products, games CASCADE`);
  const [game] = await db.insert(schema.games).values({ slug: "g", name: "G" }).returning();
  const [product] = await db.insert(schema.products).values({ gameId: game.id, title: "P", priceCents }).returning();
  await db.insert(schema.inventoryItems).values({ productId: product.id, credentialsEnc: encrypt("acc:pw") });
  const { order } = await createOrder({ email: "c@x.com", lines: [{ productId: product.id, qty: 1 }], providerId: "crypto" });
  const dep = (await db.select().from(schema.cryptoDeposits))[0];
  return { order, dep };
}
const status = async (o: { id: string; accessToken: string }) => (await getOrderForCustomer(o.id, o.accessToken))?.order.status;

afterAll(() => sql.end());
beforeEach(() => void 0);

describe("wallet", () => {
  it("xpub-derived address equals the address the seed holder can spend from", () => {
    expect(deriveAddress(XPUB, 5)).toBe(seed.deriveChild(5).address.toLowerCase());
    expect(deriveAddress(XPUB, 0)).not.toBe(deriveAddress(XPUB, 1));
  });
  it("provider is enabled only with an xpub and rejects webhooks", async () => {
    expect(cryptoProvider.enabled()).toBe(true);
    await expect(cryptoProvider.parseWebhook("", new Headers())).rejects.toThrow();
  });
});

describe("crypto scanner", () => {
  it("assigns a distinct derived address to every order", async () => {
    const first = await newOrder();
    const productId = (await db.select().from(schema.products))[0].id;
    await db.insert(schema.inventoryItems).values({ productId, credentialsEnc: encrypt("acc2:pw") });
    await createOrder({ email: "d@x.com", lines: [{ productId, qty: 1 }], providerId: "crypto" });
    const deps = await db.select().from(schema.cryptoDeposits);
    expect(new Set(deps.map((d) => d.address)).size).toBe(2);
    for (const d of deps) expect(d.address).toBe(deriveAddress(XPUB, d.idx!));
    expect(first.dep.address).toBe(deriveAddress(XPUB, first.dep.idx!));
  });

  it("delivers after exact payment once confirmations are reached", async () => {
    const { order, dep } = await newOrder();
    const chain = fakeChain();
    chain.transfer(USDC, dep.address, 19);
    chain.mine(3);
    expect((await scanDeposits(chain.rpc, cfg)).paid).toBe(0); // not confirmed yet
    expect(await status(order)).toBe("pending");
    chain.mine(20);
    expect((await scanDeposits(chain.rpc, cfg)).paid).toBe(1);
    expect(await status(order)).toBe("delivered");
    expect((await getOrderForCustomer(order.id, order.accessToken))?.lines[0].credentials).toBe("acc:pw");
  });

  it("accepts USDT too and is idempotent on rescans and duplicate logs", async () => {
    const { order, dep } = await newOrder();
    const chain = fakeChain();
    const l = chain.transfer(USDT, dep.address, 19);
    chain.transfer(USDT, dep.address, 0, { dup: l });
    chain.mine(30);
    await scanDeposits(chain.rpc, cfg); await scanDeposits(chain.rpc, cfg);
    expect(await status(order)).toBe("delivered");
    expect(await db.select().from(schema.cryptoTransfers)).toHaveLength(1);
  });

  it("handles underpayment then a top-up to the same address", async () => {
    const { order, dep } = await newOrder();
    const chain = fakeChain();
    chain.transfer(USDC, dep.address, 10);
    chain.mine(30);
    await scanDeposits(chain.rpc, cfg);
    expect(await status(order)).toBe("pending");
    chain.transfer(USDC, dep.address, 9);
    chain.mine(30);
    await scanDeposits(chain.rpc, cfg);
    expect(await status(order)).toBe("delivered");
  });

  it("tolerates a tiny shortfall (on-ramp rounding) but not a real one", async () => {
    const { order, dep } = await newOrder();
    const chain = fakeChain();
    chain.transfer(USDC, dep.address, 18.95); // 0.26% short
    chain.mine(30);
    await scanDeposits(chain.rpc, cfg);
    expect(await status(order)).toBe("delivered");
    const b = await newOrder();
    const c2 = fakeChain();
    c2.transfer(USDC, b.dep.address, 18.5); // 2.6% short
    c2.mine(30);
    await scanDeposits(c2.rpc, cfg);
    expect(await status(b.order)).toBe("pending");
  });

  it("ignores lookalike token contracts and transfers to other addresses", async () => {
    const { order, dep } = await newOrder();
    const chain = fakeChain();
    chain.transfer("0x" + "11".repeat(20), dep.address, 19);            // scam token contract
    chain.transfer(USDC, "0x" + "22".repeat(20), 19);                    // someone else's address
    chain.mine(30);
    expect((await scanDeposits(chain.rpc, cfg)).paid).toBe(0);
    expect(await status(order)).toBe("pending");
  });

  it("flags overpayment for manual refund", async () => {
    const { order, dep } = await newOrder();
    const chain = fakeChain();
    chain.transfer(USDC, dep.address, 40);
    chain.mine(30);
    await scanDeposits(chain.rpc, cfg);
    expect(await status(order)).toBe("delivered");
    const audit = await db.select().from(schema.auditLog).where(dsql`action = 'crypto_overpaid'`);
    expect(audit).toHaveLength(1);
  });

  it("picks up where it left off after downtime (cursor) without missing transfers", async () => {
    const { order, dep } = await newOrder();
    const chain = fakeChain();
    chain.mine(30);
    await scanDeposits(chain.rpc, cfg);                    // cursor set, nothing paid
    chain.mine(5000);                                       // long outage
    chain.transfer(USDC, dep.address, 19);
    chain.mine(30);
    await scanDeposits(chain.rpc, cfg);
    expect(await status(order)).toBe("delivered");
  });
});
