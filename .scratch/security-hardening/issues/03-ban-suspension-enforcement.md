# 03 — Enforce player ban & suspension on all player routes

**What to build:** `authenticate` middleware rejects suspended or banned accounts so every player route inherits enforcement.

**Blocked by:** none

**Status:** ready-for-agent

## Scope

- In `middleware/authenticate.js` (the mounted path at `:48-68`): after resolving the user row, check:
  - `users.is_suspended = true` → `403 { code: 'ACCOUNT_SUSPENDED' }`.
  - `users.status = 'banned'` → `403 { code: 'ACCOUNT_BANNED' }`.
- Read `is_suspended`/`status` in the same query that upserts the user (single round-trip).
- Semantics per `CONTEXT.md` (added this session):
  - **Player Suspension** — reversible admin action: stops creating Bookings, registering for Events, and holding Slots. Existing confirmed Bookings remain valid and Check-in still works (do NOT block `GET` reads or existing booking pages).
  - **Player Ban** — permanent: sign-in revoked entirely (`403` on everything incl. read routes).
- Ensure `requireRole` (`requireRole.js`) keeps admin/owner checks as-is — admin routes must not be blocked by a player-level suspension of the caller when the caller is admin.

## Verification

- Vitest: suspended player — bookstore returns `403 ACCOUNT_SUSPENDED`, read of own booking `200`; banned player — anything returns `403 ACCOUNT_BANNED`; admin unaffected by player status.
- Confirm the existing suite still passes because the happy paths use healthy users.

## Done criteria

- [ ] Suspension blocks create/register/hold but not read/check-in of existing bookings.
- [ ] Ban blocks everything for that account.
- [ ] Admin-role callers unaffected.
- [ ] Regression tests green.