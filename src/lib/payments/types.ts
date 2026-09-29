export type PaymentEvent = {
  externalId: string;
  status: "paid" | "failed" | "expired";
  /** amount the provider says was paid, in cents; verified against our record */
  amountCents: number;
  raw: unknown;
};

/**
 * Every payment method (crypto gateway, high-risk acquirer, own USDT wallet
 * watcher...) implements this. Swapping a provider must not touch order logic.
 */
export interface PaymentProvider {
  id: string;
  label: string;
  enabled(): boolean;
  createPayment(input: {
    orderId: string;
    amountCents: number;
    currency: string;
    email: string;
  }): Promise<{ externalId: string; redirectUrl: string }>;
  /** Must verify the signature and throw on anything suspicious. */
  parseWebhook(rawBody: string, headers: Headers): Promise<PaymentEvent>;
}
