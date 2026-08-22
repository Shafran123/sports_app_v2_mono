# 05 — Vercel: user app (player-facing)

Type: task
Status: ready-for-human

## Context

`apps/user` is a Next.js 15 client-rendered app; REST and images flow through Vercel rewrites to Railway. Deploying `main` only — no preview deployments.

## Steps

1. Vercel → Add New Project → import `Shafran123/sports_app_v2_mono` → framework Next.js → **Root Directory `apps/user`** → project name `sports-app-user` (stable `sports-app-user.vercel.app`).
2. Env (Production):
   - `NEXT_PUBLIC_API_URL` = Railway `https://*.up.railway.app` URL
   - `NEXT_PUBLIC_FIREBASE_API_KEY` / `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` / `NEXT_PUBLIC_FIREBASE_PROJECT_ID` / `NEXT_PUBLIC_FIREBASE_APP_ID` — same Firebase project as local
3. Settings → Git: deployments **only on `main`** (no preview builds).
4. Deploy; confirm `sports-app-user.vercel.app` loads the app and `/api/...` rewrites reach Railway.

## Done

- [ ] Project builds and serves; `/api/v1/health` through the rewrite → 200.
- [ ] Loading the root page shows no console network errors to `/api` outside the app origin.
- [ ] Previews disabled.

Blocked by: 01, 03

## Notes

- If `next build` fails on file tracing of workspace packages, set `outputFileTracingRoot: path.join(__dirname, '../../')` in `next.config.mjs` — Vercel's monorepo detection usually handles it; do not add unless observed.