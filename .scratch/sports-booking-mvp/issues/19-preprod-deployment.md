# 19 — Pre-prod deployment

**What to build:** the whole MVP runs in pre-prod — frontend on Vercel, backend on Railway, Supabase dev project, Firebase project, PayHere sandbox — seeded and smoke-tested end to end, with all secrets in env vars.

**Blocked by:** 11 — Booking history + cancel/rebook; 13 — Check-in + manual bookings; 16 — Events register/pay; 17 — Admin panel.

**Status:** ready-for-agent

- [ ] Vercel (FE) and Railway (BE) deployments succeed with env-only configuration (no secrets in code)
- [ ] Supabase migrations + seed applied to the dev project; PayHere sandbox creds and webhook URL configured
- [ ] FCM push keys, Resend key, and Firebase config wired via env vars
- [ ] Smoke checklist passes: player signup → book → pay → QR; owner login → calendar → check-in; admin login → approve venue → refund
- [ ] README documents pre-prod setup, env vars, seed, and smoke checklist

## Comments
Docs written (2026-08-19). Deploy steps remain: create Supabase pre-prod project, set env vars on Vercel/Railway, verify PayHere sandbox webhook reachability.
