export type Token = { symbol: string; address: string; decimals: number };

export type CryptoConfig = {
  chainId: number;
  chainName: string;
  rpcUrl: string;
  xpub: string;
  tokens: Token[];
  confirmations: number;
  /** accept payments this many basis points short (exchange/on-ramp rounding) */
  toleranceBps: number;
  lookbackBlocks: number;
  explorerTx: string;
};

// Polygon PoS mainnet stablecoins. VERIFY these on the official token pages before going live.
const POLYGON_TOKENS: Token[] = [
  { symbol: "USDC", address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
  { symbol: "USDT", address: "0xc2132D05D31c914a87C6611C10748AEb04B58e0e", decimals: 6 },
];

export function cryptoConfig(): CryptoConfig | null {
  const xpub = process.env.CRYPTO_XPUB;
  if (!xpub) return null;
  return {
    chainId: Number(process.env.CRYPTO_CHAIN_ID ?? 137),
    chainName: process.env.CRYPTO_CHAIN_NAME ?? "Polygon",
    rpcUrl: process.env.CRYPTO_RPC_URL ?? "https://polygon-rpc.com",
    xpub,
    tokens: process.env.CRYPTO_TOKENS ? (JSON.parse(process.env.CRYPTO_TOKENS) as Token[]) : POLYGON_TOKENS,
    confirmations: Number(process.env.CRYPTO_CONFIRMATIONS ?? 30),
    toleranceBps: Number(process.env.CRYPTO_TOLERANCE_BPS ?? 50),
    lookbackBlocks: Number(process.env.CRYPTO_LOOKBACK_BLOCKS ?? 10000),
    explorerTx: process.env.CRYPTO_EXPLORER_TX ?? "https://polygonscan.com/tx/",
  };
}
