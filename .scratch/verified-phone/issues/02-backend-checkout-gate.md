# 02 — Backend: checkout gate + verification lifecycle

**What to build:** enforce the verified-phone rule server-side: checkout gate, profile phone-change semantics, admin mark-verified endpoint.

**Blocked by:** 01

**Status:** ready-for-agent

## Scope

- `bookingController.checkout`: before creating the hold or cash booking — if `!req.user.phone_verified_at || !req.user.phone`, respond `409` with structured code `VERIFIED_PHONE_REQUIRED` (and the user's current phone/verified state so the client can drive the verify modal). The gate is server-side truth — no client can bypass it.
- `authController.updateMe`: when the payload `phone` differs from the user's current `users.phone`, set `phone_verified_at = NULL` (new number requires re-verification). Matching phone → no change.
- Admin override: `POST /admin/players/:id/verify` (admin-role guarded) sets `phone_verified_at = now()` on an existing player — used for pre-prod/test users per Q4. Include list+search support in 05; this ticket is just the endpoint + guard.
- Stamp `player_phone` on bookings created via `checkout` from the verified user's phone (snapshot; immutable afterwards).

## Verification

- Backend tests: unverified user → `409 VERIFIED_PHONE_REQUIRED` (both online and cash paths); verified user → booking created with `player_phone`; phone change clears verification; admin verify endpoint sets it; non-admin gets 403.

## Done criteria

- [ ] Checkout 409 for unverified; bookings stamp `player_phone`
- [ ] Phone change clears `phone_verified_at`
- [ ] Admin mark-verified endpoint works with role guard
- [ ] Tests green