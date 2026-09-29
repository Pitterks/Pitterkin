import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { PaymentProvider } from "../types";
import { cryptoConfig } from "./config";
import { deriveAddress } from "./wallet";

export const cryptoProvider: PaymentProvider = {
  id: "crypto",
  label: "Crypto (USDT / USDC)",
  enabled: () => cryptoConfig() !== null,

  async createPayment({ amountCents }) {
    const cfg = cryptoConfig()!;
    const externalId = `crypto_${randomUUID()}`;
    await db.transaction(async (tx) => {
      // the identity column hands out a unique derivation index; address is set right after
      const [row] = await tx.insert(schema.cryptoDeposits).values({
        externalId, address: externalId, chainId: cfg.chainId, expectedCents: amountCents,
      }).returning({ idx: schema.cryptoDeposits.idx });
      await tx.update(schema.cryptoDeposits)
        .set({ address: deriveAddress(cfg.xpub, row.idx!) })
        .where(eq(schema.cryptoDeposits.externalId, externalId));
    });
    return { externalId, redirectUrl: `/pay/crypto/${externalId}` };
  },

  // Chain payments have no webhooks: the scanner reports them. Refuse anything sent here.
  async parseWebhook() {
    throw new Error("crypto provider has no webhook");
  },
};
