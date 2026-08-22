# 06 — Vercel: admin app (owner/operator console)

Type: task
Status: ready-for-human

## Context

`apps/admin` is identical to the user app plus socket.io realtime (front desk) and charts. It needs `NEXT_PUBLIC_SOCKET_URL` or realtime silently falls back to polling. Deploying `main` only.

## Steps

1. Vercel → Add New Project → import `Shafran123/sports_app_v2_mono` → framework Next.js → **Root Directory `apps/admin`** → project name `sports-app-admin` (stable `sports-app-admin.vercel.app`).
2. Env (Production): the same five as ticket 05, **plus**:
   - `NEXT_PUBLIC_SOCKET_URL` = Railway `https://*.up.railway.app` URL
3. Settings → Git: deployments **only on `main`** (no preview builds).
4. Deploy; confirm the front desk page sockets connect (network tab shows a `socket.io` handshake to Railway — the admin origin must be in `SOCKET_ALLOWED_ORIGINS`, ticket 04).

## Done

- [ ] Project builds and serves; front-desk page establishes a live socket connection (not polling).
- [ ] Previews disabled.

Blocked by: 01, 03