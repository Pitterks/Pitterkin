# Crypto payments (own wallet)

## How it works
- Every order gets its **own deposit address**, derived from the store's **xpub** (public key only).
  The server can see and receive funds but **cannot spend them**. No private key ever touches the server.
- The buyer sends USDC or USDT on Polygon to that address. Under/overpayment is handled:
  top-ups to the same address are summed; a shortfall up to `CRYPTO_TOLERANCE_BPS` (0.5%) is accepted.
- The scanner (`npm run watcher` or `POST /api/cron/crypto-scan` with `Authorization: Bearer $CRON_SECRET`)
  reads Transfer logs after `CRYPTO_CONFIRMATIONS` blocks, stores them idempotently and settles the order.
- Overpayments are flagged in `audit_log` (`crypto_overpaid`) for a manual refund.
- The same address scheme is what a card on-ramp widget will send to later ("Pay by card").

## Going live checklist
1. **On your own computer** (offline if possible): `npm run wallet:new`. Write the seed phrase on paper.
   Put only `CRYPTO_XPUB` into the server env. Never put the phrase on a server, in chat, or in git.
2. Use a dedicated RPC (Alchemy/Ankr/QuickNode). Public RPCs rate-limit `eth_getLogs`.
3. **Verify the token contract addresses** in `src/lib/payments/crypto/config.ts` against the official
   Circle/Tether pages. Wrong address = wrong money. Override with `CRYPTO_TOKENS` if needed.
4. Test on a testnet first (set `CRYPTO_CHAIN_ID`, `CRYPTO_RPC_URL`, `CRYPTO_TOKENS`, `CRYPTO_EXPLORER_TX`).
5. Schedule the scanner every 15–60 s and alert if `scannedTo` stops advancing.
6. Sweeping: from the seed, import the first N derived keys into a wallet and move funds to cold storage regularly.
7. Manual queue: orders in `disputed` (paid but stock gone) and `crypto_overpaid` audit rows need a human refund.

## Known limits (next up)
- Polygon only for now. Tron/BSC can be added as more chains behind the same scanner.
- Reservation is 30 min; a later payment still succeeds if the account is still free, else goes to manual refund.
