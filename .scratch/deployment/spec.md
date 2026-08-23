# Deployment Cutover — sports_app_v2_mono → Vercel + Railway (pre-prod)

Status: ready-for-agent

## Problem Statement

The app has been built and tested locally only. `sp_fe` (old frontend) is dead; the working frontends live in the monorepo (`apps/user`, `apps/admin`) and the backend in `sp_be`. The new GitHub repo `Shafran123/sports_app_v2_mono` is empty; no code has been deployed anywhere. This effort cuts the monorepo (including `sp_be`) into that repo and deploys it to pre-prod: user app + admin app on Vercel (two projects), backend on Railway, Postgres on a fresh Supabase database — all with configurations identical to local (PayHere sandbox, same Firebase project, same Mailgun/SMSGo credentials).

## Current State (verified)

- Monorepo: pnpm workspace + Turborepo. `apps/user` and `apps/admin` are Next.js 15.2.2 client-rendered apps (no API routes, no server actions, no middleware). All data flows to `sp_be` via a `next.config.mjs` rewrite `/api/:path* → ${NEXT_PUBLIC_API_URL}/api/v1/:path*` (fallback `http://localhost:2400`).
- `packages/api` is a browser axios client (`baseURL: "/api"`, Bearer token, 401 → redirect). `packages/auth` reads `NEXT_PUBLIC_FIREBASE_API_KEY|AUTH_DOMAIN|PROJECT_ID|APP_ID`. `apps/admin` also reads `NEXT_PUBLIC_SOCKET_URL` (socket.io realtime; falls back to polling when unset).
- `sp_be` (Node 18, CommonJS, Express 4, Postgres via `pg`, socket.io, firebase-admin, Mailgun HTTP, SMSGo) is currently **gitignored with its own nested `.git`**. Boot is fail-closed on 7 required env vars. Jobs (hourly booking reminders, 06:06 Colombo daily digest) run in-process. Uploads go to local disk `sp_be/uploads/` (base64 JSON body, magic-byte validated, returns `/uploads/<uuid>.<ext>`), served statically.
- `.gitignore` has `*.json` (all JSON ignored) with exceptions `!/sp_be/.env*`, `!/sp_fe/.env*`, and `sports-app-20029-firebase*.json`. `sp_be/package.json` and `sp_be/package-lock.json` are currently **ignored** — Railway nixpacks needs them committed.
- PayHere is sandbox (`PAYHERE_CHECKOUT_URL` defaults to `https://sandbox.payhere.lk/pay/checkout`; `@spots/api` hardcodes sandbox submit). `payhere_enabled` feature flag defaults OFF (cash-only checkout) until flipped in admin console.
- `FRONTEND_URL` is overloaded: it is the base for PayHere `return_url`, booking-QR deep links, and email bases (user-facing) **and** the CORS origin for REST + socket.io. It must stay the **user app's** origin; sockets need a separate allow-list.

## Decisions (grill tree — all confirmed)

| # | Decision | Choice |
|---|---|---|
| Q1 | Repo cutover | Cut the whole tree (incl. `sp_be`, minus `sp_fe`) into `sports_app_v2_mono`; delete `sp_be/.git`; remove `sp_fe/` from the working tree; firebase JSON stays excluded; single history on `main`. |
| Q2 | Deploy trigger | Import from GitHub on `main`; push-to-deploy for all three targets. |
| Q3 | URLs now | Free defaults (`*.vercel.app`, `*.up.railway.app`); custom domains = follow-up ticket. |
| Q4/Q11 | Database | **Fresh Supabase Postgres** provisioned for this deploy; `DATABASE_URL` points at it; one manual `npm run db:setup` (migrations 0001–0013 + idempotent seed) at cutover. No auto-migrate in the pipeline yet. |
| Q5/Q8 | Image persistence | **Supabase Storage** (ADR-0010, bucket `venue_images`) — backend-mediated uploads, absolute public URLs in `photos[]`. The interim Railway volume (below) is **obsolete and removed** (see `.scratch/supabase-storage/`). |
| Q6 | Payments | **Sandbox**, identical merchant config as local — in production envs. Live cutover = follow-up ticket gated behind a sandbox E2E test. |
| Q9 | Origins | `FRONTEND_URL` = **user app origin** (unchanged semantics: return_url, QR, emails). New `SOCKET_ALLOWED_ORIGINS` (comma-separated, fallback `FRONTEND_URL`) used by socket.io CORS only. The single real backend code change. |
| Q10 | Previews | No preview deployments; Vercel projects build `main` only. |

## Target Topology

```
github.com/Shafran123/sports_app_v2_mono (main)
  ├─ Vercel 1: apps/user     → sports-app-user.vercel.app    (env: NEXT_PUBLIC_API_URL, FIREBASE×4)
  ├─ Vercel 2: apps/admin     → sports-app-admin.vercel.app   (env: + NEXT_PUBLIC_SOCKET_URL)
  └─ Railway: sp_be           → sports-be.up.railway.app      (env: DATABASE_URL, FRONTEND_URL, SOCKET_ALLOWED_ORIGINS, SUPABASE_*, …)
     └─ Supabase project jxhhlwgwcarhhujhwctv ← DATABASE_URL + Storage bucket venue_images
```

Browser traffic: REST flows same-origin through each app's Vercel rewrites → Railway `/api/v1/*`. Socket.io flows **directly** browser → Railway (hence `SOCKET_ALLOWED_ORIGINS`). Venue photos are absolute Supabase public URLs rendered directly from the storage CDN (no backend hop, no rewrite). PayHere notify is hit by PayHere's servers → `API_PUBLIC_URL` (Railway URL, must be reachable from the internet).

## Env Vars To Set

### Railway (sp_be) — copy local `sp_be/.env`, then override:

| Var | Value |
|---|---|
| `DATABASE_URL` | fresh Supabase Postgres connection string |
| `FRONTEND_URL` | `https://sports-app-user.vercel.app` |
| `API_PUBLIC_URL` | `https://sports-be-production.up.railway.app` |
| `SOCKET_ALLOWED_ORIGINS` | `https://sports-app-admin.vercel.app,https://sports-app-user.vercel.app` |
| `PAYHERE_*` | identical to local (sandbox) |
| `GOOGLE_APPLICATION_CREDENTIALS` / `FIREBASE_SERVICE_ACCOUNT` | same Firebase project as local |
| `MAILGUN_*`, `SMSGO_*`, `FROM_EMAIL`, `ADMIN_EMAIL`, `OTP_HMAC_SECRET`, `PORT=2400` | identical to local |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase project `jxhhlwgwcarhhujhwctv` (required — boot fails without them) |

### Vercel user (root dir `apps/user`):

`NEXT_PUBLIC_API_URL` → Railway URL · `NEXT_PUBLIC_FIREBASE_API_KEY` · `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` · `NEXT_PUBLIC_FIREBASE_PROJECT_ID` · `NEXT_PUBLIC_FIREBASE_APP_ID`

### Vercel admin (root dir `apps/admin`) — same five, plus:

`NEXT_PUBLIC_SOCKET_URL` → Railway URL

## Backend Code Delta (exact)

```js
// sp_be/utils/origins.js (new)
function getAllowedOrigins(env) {
  const list = (env.SOCKET_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return list.length ? list : [env.FRONTEND_URL].filter(Boolean);
}
module.exports = { getAllowedOrigins };
```

```js
// sp_be/realtime.js — replace the single-origin line:
cors: { origin: getAllowedOrigins(process.env), credentials: true }
```

`app.js` CORS, `utils/payhere.js`, `utils/tokens.js` are **unchanged** — REST is same-origin via the Vercel rewrites, and `FRONTEND_URL` stays the player-facing base for `requestBaseUrl()`.

`sp_be/config/env.js`: add `SOCKET_ALLOWED_ORIGINS` to the optional vars (validated when set: non-empty after split/trim).

`sp_be/.env.example`: document the new var.

`sp_be/test/origins.test.js`: split/trim/empty-list fallback to `FRONTEND_URL`.

```js
// apps/user/next.config.mjs AND apps/admin/next.config.mjs — add to rewrites()
rewrites: async () => [
  { source: "/api/:path*", destination: `${NEXT_PUBLIC_API_URL}/api/v1/:path*` },
  { source: "/uploads/:path*", destination: `${NEXT_PUBLIC_API_URL}/uploads/:path*` },  // new
]
```

Photos render via plain `<img src="/uploads/...">`, no `next/image` — no remotePatterns needed.

## Runbook (executed after tickets land)

1. Cutover commit (`ticket 01`) → push `main` to `sports_app_v2_mono`.
2. Backend origin split (`ticket 02`) + Vercel rewrites (`ticket 03`) land before the push.
3. Railway: import repo (root dir `sp_be`), nixpacks build, env vars, deploy; healthcheck `GET /health` 200; `npm run db:setup` once. (No volume — uploads live in Supabase Storage.)
4. Vercel ×2: import (root dirs), envs, **disable previews**, deploy.
5. Smoke the full checklist (`ticket 07`).

## Verification Checklist (post-cutover, ticket 07)

- [ ] `/health` 200; all 13 migrations + seed applied to the fresh DB (18 sports, seed venues, demo accounts).
- [ ] User app: sign-in (Firebase), browse venues, venue detail renders photos from Supabase Storage (absolute URLs, no rewrite).
- [ ] Checkout: cash walk-in booking; flip `payhere_enabled` ON in admin → sandbox PayHere checkout round-trips (`return_url` lands on the USER app).
- [ ] Confirmation email (Mailgun) + SMS (SMSGo) arrive; booking QR renders; check-in via admin console front desk consumes the token; walk-in guest flow works.
- [ ] Admin app: overview charts, Platform Settings (flags/tax toggles fire + audit), realtime front desk updates via socket (`NEXT_PUBLIC_SOCKET_URL`).
- [ ] Photo upload from admin persistence: upload → trigger Railway redeploy → image still 200 after redeploy (Supabase Storage).
- [ ] Jobs: `startReminderJob` runs on boot; daily digest fires 06:06 Asia/Colombo.

## Rollback

- Railway: previous deployment; Vercel: redeploy previous commit. Photos live in Supabase Storage, unaffected by app/backend rollbacks.
- DB: pre-prod only — point `DATABASE_URL` at the old pre-prod DB if needed.

## Known Issues / Follow-ups (deferred by design)

- Photos live in Supabase Storage (ADR-0010 fulfilled) — not the Railway volume. The volume is removed; see `.scratch/supabase-storage/` for the migration.
- PayHere live + refunds. → ticket 08
- Custom domains + env freeze (FRONTEND_URL, API_PUBLIC_URL, SOCKET_ALLOWED_ORIGINS). → ticket 10
- Firebase project, Mailgun, SMSGo remain the local/dev tenant — same tenant serves dev + pre-prod (single-tenant, accepted for now).

## Out of Scope

- CI/CD, auto-migrations, `output: export`, Docker, webhooks into GitHub Actions, IPv6/Railway custom domains, iOS/Android builds, multi-tenant dev/prod split, sp_fe deletion from the working tree only (already listed in ticket 01).