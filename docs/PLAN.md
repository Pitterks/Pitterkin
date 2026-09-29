# Plan

## Constraints (decided)
- Market: worldwide except CIS. Language: English.
- No legal entity at launch. Own supply, legally sourced.
- Local prototype first; hosting decided later.

## Payments without a legal entity
Card acquirers (Stripe, PayPal, Paddle, Lemon Squeezy) prohibit game-account sales and require a
business — do not use them. High-risk acquirers need KYB, which needs an entity.

Launch with crypto only:
1. **Own USDT (TRC20/Polygon) + USDC wallet with on-chain watcher** — no third party can freeze it; unique amount/address per order.
2. **One non-custodial-style gateway** (verify current terms before connecting) as convenience layer, behind `PaymentProvider`.
3. Add cards later via a high-risk acquirer once an entity exists.

Rules: sweep balances out of gateways frequently, never keep large balances on any provider, keep 2+ providers.

## Roadmap
| Phase | Scope | Time |
|---|---|---|
| Done | Prototype: catalog, checkout, reservation, delivery, admin v0, tests | — |
| Done | Phase 1 (partly): cart, warranty claims + replacement, email outbox | — |
| 1 | Remaining: user accounts (magic link), real email provider key (Resend) | 0.5 wk |
| 2 | Crypto providers (own wallet watcher + gateway), order emails, tickets | 2 wks |
| 3 | Admin v1: product CRUD, RBAC + 2FA, audit UI, coupons, analytics | 2 wks |
| 4 | Design system/brand, SEO, reviews, image storage, Turnstile | 2 wks |
| 5 | Hardening, backups, deploy, monitoring, soft launch | 1 wk |
