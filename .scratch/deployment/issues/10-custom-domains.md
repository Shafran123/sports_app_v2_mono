# 10 — Custom domains + origin freeze (post-launch follow-up)

Type: task
Status: ready-for-human

## Context

Pre-prod runs on free `*.vercel.app` / `*.up.railway.app` URLs (decision Q3 — deliberate). Once real usage starts, the free domains are not acceptable for players.

## Deliverables

- Map custom domains: user app (root, e.g. `spots.lk`), admin app (subdomain), Railway via `API_PUBLIC_URL` conventions.
- Update the frozen origin envs together in one change-set: `FRONTEND_URL` (user), `SOCKET_ALLOWED_ORIGINS` (admin + user), `API_PUBLIC_URL` (Railway), Vercel domain config, PayHere `return_url`/notify implications.
- Verify every player-facing link (booking emails, QR deep links, PayHere return) resolves on the new domains; re-run ticket 07's email link checks.
- Record the mapping in the deploy doc so nothing silently diverges.

## Done

- [ ] All three origins resolve on custom domains; email/QR/PayHere links verified; env freeze documented.

Blocked by: 07