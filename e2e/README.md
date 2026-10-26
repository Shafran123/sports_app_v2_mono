# E2E testing (Playwright)

End-to-end UI tests for the Site Customer and Venue Owner flows, plus an admin
smoke pass (P2). Runs against the **real local stack** — Express backend,
Postgres, and the Next apps — on a fresh throwaway database per run. See
`docs/adr/0048-playwright-e2e-strategy.md` for the full strategy.

## Prerequisites

- Postgres running locally (the harness creates/drops `sports_e2e` via the
  `postgres` maintenance database — no manual DB setup).
- Ports free: 2499 (storage stub), 2410 (backend), 3010 (user app),
  3011 (admin app). The harness refuses to run if they are taken.

## Setup (once)

```sh
pnpm e2e:install     # installs e2e deps + the Chromium browser
```

## Running

```sh
pnpm e2e            # fresh DB → migrate → seed → fixtures → run all specs → drop DB
pnpm e2e:ui         # same, but with Playwright's interactive web UI
pnpm e2e:headed     # run with a visible browser
pnpm e2e:report     # open the last HTML report (written to e2e/reports/html)
```

`pnpm e2e` is deliberately **not** part of `pnpm test` — the unit/component
suite stays fast.

## What is covered

| Spec | Role / surface | Coverage |
|---|---|---|
| `00-warmup` | — | Warms the Next dev routes so the lazy first-visit compile never flakes a real spec |
| `site-smoke` | guest | Platform host shows the marketplace-closed slate; site home lists the seeded venues; venue page resolves on the site host |
| `site-booking-journey` | guest → Site Customer | Real form sign-up (name/email/password), phone + email OTP verification, cash checkout, booking confirmed, QR page, DB row asserted |
| `site-bookings` | Site Customer | Booking confirmation page with QR (the site has no bookings list — the marketplace route is retired, ADR-0045) |
| `owner-console` | Venue Owner | Dashboard, confirm a pending booking, front-desk check-in by pasting the booking code, quick-book a walk-in cash booking |
| `owner-config` | Venue Owner | Booking settings toggle (persisted), pricing grid paint + save, Widget & site embed key + brand edit, customers directory search |
| `admin-smoke` | Admin (P2) | Dashboard, venue approvals queue, settings feature-flags panel |

## Auth in the harness

- **Owner/admin**: HS256 JWTs signed with `JWT_SECRET` (the backend runs with
  `NODE_ENV=test`), injected into `localStorage` as `spots_token`. The
  `NEXT_PUBLIC_E2E=1` seam in `packages/auth` restores the session from that
  token instead of Firebase — never set outside this harness.
- **Site Customer**: seeded account with a real session row (opaque bearer
  token, `site_customer_token`), plus the one real-form registration journey.

## Fixtures

`e2e/fixtures/` runs after the migrations + seed on the fresh DB:

- live `site_domain_requests` row for `mysite.localhost` (the site hostname —
  resolves via mDNS, no `/etc/hosts` edit needed)
- cash payment method on, PayHere off, owner onboarding accepted
- a Site Customer (email `e2e.customer@mysite.test`) with a session
- one pending + one confirmed booking tomorrow (14:00 / 16:00 LK) on Smash
  Arena for the owner flows

## Gotchas

- OTP codes are never delivered (no Mailgun/SMSGo) — `helpers/otp.mjs`
  brute-forces the 6-digit code offline against `OTP_HMAC_SECRET`.
- The harness machine may be on any timezone; the app runs on Colombo time.
  Slot selection uses absolute UTC math (`pickFutureSlot`), never local
  wall-clock.
- `next dev` compiles each route lazily — the warm-up spec absorbs that cost.