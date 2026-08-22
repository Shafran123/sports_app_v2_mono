# 05 — apps/admin: Players section with mark-verified

**What to build:** admin console Players list + search + mark-verified action (pre-prod / test users per Q4).

**Blocked by:** 02

**Status:** ready-for-agent

## Scope

- New `apps/admin/src/features/players/` section: list players (id, name, email, phone, verified status, role) with search; verified status from `users.phone_verified_at`.
- "Mark verified" action per row → `POST /admin/players/:id/verify` (02); row updates in place; shows badge when verified.
- Admin-only guard (reuse existing console guard patterns).
- Note: walk-in bookings identify players via `player_name/player_phone` without a user row — list covers only real `users` rows; walk-ins are out of scope (exempt from the gate).

## Verification

- Widget tests: list renders, search filters, mark-verified calls endpoint and updates row, non-admin hidden.
- Manual: mark a test player verified → they can book without OTP.

## Done criteria

- [ ] Players list + search render verified status
- [ ] Mark-verified works and reflects immediately
- [ ] Tests green; typecheck green