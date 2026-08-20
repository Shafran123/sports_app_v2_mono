# 10 — Payment webhooks + refunds

**What to build:** PayHere's server webhook drives the payment state machine: HMAC-verified, idempotent by payment id. Success confirms the booking (hold → confirmed); failure releases the hold. The refund API reverses money to the card and updates states.

**Blocked by:** 09 — Booking flow (hold → pay → QR).

**Status:** ready-for-agent

- [ ] Webhook verifies HMAC signature; unsigned requests are rejected
- [ ] Success webhook: payment PAID, booking HELD → CONFIRMED; replaying the same webhook changes nothing
- [ ] Failure webhook: payment FAILED, hold released, slot available again
- [ ] Payment records store currency, amount (integer LKR), gateway reference, and timestamp
- [ ] Refund endpoint (admin) issues a PayHere refund and marks payment REFUNDED; refunds are idempotent (no double refund)

## Comments
Completed: 2026-08-19
