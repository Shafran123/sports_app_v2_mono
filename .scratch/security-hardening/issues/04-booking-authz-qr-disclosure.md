# 04 — Booking read authorization + QR token disclosure contract

**What to build:** fix the cross-tenant booking read and enforce the QR Token disclosure rule.

**Blocked by:** none

**Status:** ready-for-agent

## Scope

- `GET /bookings/:id` (`bookingController.js:268-270`) currently allows *any* `venue_owner` to read *any* booking, leaking player name, phone, `qr_token`, `idempotency_key`.
  - New rule: allowed when `booking.user_id === req.user.id`, or `req.user.role === 'admin'`, or the caller owns the venue of `booking.venue_id` (join `venues.owner_id`).
- `qr_token` inclusion: only when `req.user.id === booking.user_id` (i.e. your own booking). Never in:
  - `GET /bookings` (list), admin list endpoints, event-related reads, owner/POS reads — field-stripped.
  - The webhook confirm responses and realtime payloads.
- Check the shape serializers: confirm no other route that returns bookings embeds `qr_token` (grep `qr_token` across responses).
- `idempotency_key`: own player and owning venue only (it is already effectively secret-bound to the booking; same stripper).
- Keep check-in as-is: scan endpoint validates venue ownership + token (calls it out in a code comment per `CONTEXT.md`).

## Verification

- Vitest:
  - Owner of venue A gets `403` reading a booking at venue B; owner of the booking's venue succeeds.
  - Player reads own booking → sees `qr_token`; same player's list response → no `qr_token`.
  - Admin sees the booking; admin response includes token only if admin is also the booking's user (never admin-only).
- Grep test: no `qr_token` in any list payload.

## Done criteria

- [ ] Cross-venue reads blocked (owner-of-counts strictly to own venues).
- [ ] `qr_token` appears exactly once in the whole API contract: one's-own `GET /bookings/:id`.
- [ ] Regression tests green.