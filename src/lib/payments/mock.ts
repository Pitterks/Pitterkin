import { randomUUID } from "node:crypto";
import { sign, safeEqual } from "@/lib/crypto";
import type { PaymentProvider } from "./types";

/** Local-only provider: lets us click through the full purchase flow. */
export const mockProvider: PaymentProvider = {
  id: "mock",
  label: "Test payment (dev only)",
  enabled: () => process.env.NODE_ENV !== "production" || process.env.MOCK_PAYMENTS === "1",

  async createPayment({ orderId }) {
    const externalId = `mock_${randomUUID()}`;
    return { externalId, redirectUrl: `/pay/mock/${externalId}?order=${orderId}` };
  },

  async parseWebhook(rawBody, headers) {
    const sig = headers.get("x-signature") ?? "";
    if (!safeEqual(sig, sign(rawBody))) throw new Error("bad signature");
    const body = JSON.parse(rawBody) as { externalId: string; status: "paid" | "failed" | "expired"; amountCents: number };
    return { ...body, raw: body };
  },
};
