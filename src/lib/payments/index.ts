import { mockProvider } from "./mock";
import { cryptoProvider } from "./crypto/provider";
import type { PaymentProvider } from "./types";

// Register real providers here (nowpayments, own-usdt, ...).
const all: PaymentProvider[] = [cryptoProvider, mockProvider];

export const providers = () => all.filter((p) => p.enabled());
export const getProvider = (id: string) => all.find((p) => p.id === id && p.enabled());
