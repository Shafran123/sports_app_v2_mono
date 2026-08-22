# 0020 — Pre-prod deployment: socket origins split; uploads on a Railway volume (ADR-0010 deferred)

- **Status:** accepted
- **Date:** 2026-08-22
- **Supersedes in part:** none — defers ADR-0010 for pre-prod

## Context

Pre-prod deploys sp_be to Railway behind two Vercel apps (user + admin). `FRONTEND_URL` had been the single origin for everything: PayHere `return_url`, booking-QR links, email bases (all player-facing) AND REST/socket CORS. Sockets connect browser → Railway directly, so the admin origin must be admitted — but changing `FRONTEND_URL` would bounce players' payment returns onto the admin console. And ADR-0010 plans Supabase Storage for venue photos, but shipping storage migration in the cutover would delay launch.

## Decision

- `FRONTEND_URL` keeps its player-facing meaning (return_url, QR/email bases) and takes the **user app** origin.
- Socket.io CORS uses a new allow-list `SOCKET_ALLOWED_ORIGINS` (comma-separated, falls back to `FRONTEND_URL` when unset) via `sp_be/utils/origins.js`. REST CORS stays `FRONTEND_URL` — REST is same-origin through Vercel rewrites.
- Venue photos persist on a Railway volume mounted at `sp_be/uploads`, served through `/uploads` rewrites on both Vercel apps. Supabase Storage (ADR-0010) remains the target; pre-prod intentionally does not implement it yet.

## Trade-offs

- Allow-list vs single origin: two moving env vars instead of one, but the alternative (single origin) is actively wrong for the socket path.
- Volume vs object storage: volume is fine for a single pre-prod instance and a small photo corpus, and unblocks launch; it is lost if the volume is destroyed and does not scale multi-region — the standing reason to still land ADR-0010 (ticket 09).

## Consequences

- Any future split (e.g., a mobile app or a second backend region) must extend `SOCKET_ALLOWED_ORIGINS`, not repurpose `FRONTEND_URL`.