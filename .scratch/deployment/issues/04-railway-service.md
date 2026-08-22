# 04 — Railway: sp_be import, fresh Postgres, volume, db:setup

Type: task
Status: ready-for-human

## Context

Backend deploys on Railway via nixpacks (`railway.toml` exists in `sp_be`, healthcheck `GET /health`, port 2400). Needs a fresh Postgres, a persistent volume for `uploads/`, all env vars, and one manual `db:setup`.

## Steps

1. Provision a **fresh Supabase Postgres**; capture `DATABASE_URL` (with SSL settings Railway accepts).
2. Railway: New Project → Deploy from GitHub → `Shafran123/sports_app_v2_mono` → **Root Directory `sp_be`**.
3. Env vars — copy local `sp_be/.env`, then set/override:
   - `DATABASE_URL` = new DB
   - `FRONTEND_URL` = `https://sports-app-user.vercel.app` (user app; *not* admin — see ticket 02)
   - `API_PUBLIC_URL` = the Railway `https://*.up.railway.app` URL
   - `SOCKET_ALLOWED_ORIGINS` = `https://sports-app-admin.vercel.app,https://sports-app-user.vercel.app`
   - `PAYHERE_*`, Mailgun, SMSGo, `OTP_HMAC_SECRET`, Firebase credential — identical to local (sandbox)
   - `PORT` = 2400 (as in `railway.toml`)
4. **Volume**: attach to the service, mount path **`/app/sp_be/uploads`** (monorepo root is `/app`).
5. Deploy; confirm `GET /health` → 200 and the healthcheck passes.
6. `npm run db:setup` once (opens `migrations` 0001–0013 in order + idempotent seed — 18 sports, demo venues, demo accounts). Confirm `schema_migrations` has 13 rows.
7. Copy local `sp_be/uploads/*` (existing venue images) into the volume.
8. Verify a test image at `/uploads/<uuid>.png` returns 200 from the Railway URL and stays after a redeploy.

## Done

- [ ] Service healthy; healthcheck green; `db:setup` applied 13 migrations + seed.
- [ ] Volume mounted at `/app/sp_be/uploads`; legacy images present; survive one redeploy.
- [ ] All env vars set; boot log shows no "missing" warnings for required vars.

Blocked by: 01, 02