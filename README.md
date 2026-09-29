# Pitterkin — digital goods store (prototype)

Next.js 15 (App Router) + PostgreSQL + Drizzle. English-first, international market.
Launch niche: Fortnite accounts; the data model is game-agnostic (`games.attribute_schema`).

## Run locally

```bash
cp .env.example .env            # set ENCRYPTION_KEY: openssl rand -hex 32
npm install
npm run db:push                 # create tables
npm run db:seed                 # demo game + products + stock
MOCK_PAYMENTS=1 npm run build && MOCK_PAYMENTS=1 npm start   # or `npm run dev`
npm test                        # needs a `shop_test` database, see vitest.config.mts
```

Store: http://localhost:3000 · Admin: http://localhost:3000/admin (`ADMIN_PASSWORD`).
The mock provider is disabled in production unless `MOCK_PAYMENTS=1`.

## What exists

- Catalog with filters (skins, price, platform, OG), product page, guest checkout by email
- Stock reservation (30 min, `FOR UPDATE SKIP LOCKED`) → no double-selling
- `PaymentProvider` interface (`src/lib/payments`) + mock provider; idempotent, amount-verified webhooks
- Credentials AES-256-GCM encrypted at rest, decrypted only for the paid order's secret link, every view audited
- Admin: dashboard (revenue/margin/stock), orders (+ mark refunded), bulk inventory import
- Cart (cookie), warranty claims with account replacement (old account retired, never resold), transactional email outbox (Resend when `RESEND_API_KEY` is set, console otherwise)
- Crypto: per-order USDC/USDT addresses on Polygon from an xpub, chain scanner with confirmations, under/overpay handling — see [docs/CRYPTO.md](docs/CRYPTO.md)
- Admin: product/game CRUD with schema-driven forms; optional TOTP 2FA (`npm run admin:totp` on your machine, then set `ADMIN_TOTP_SECRET`)
- Tests: concurrency, webhook idempotency, amount mismatch, expired/late payment paths

See [docs/PLAN.md](docs/PLAN.md) for the roadmap, payments strategy and timeline.
