# 09 — Booking flow (hold → pay → QR)

**What to build:** the full booking loop: selecting a slot creates a 10-minute hold (countdown shown), checkout redirects to PayHere, success produces a confirmation page with booking ID and QR code plus a confirmation email. Failure or expiry releases the hold.

**Blocked by:** 08 — Availability engine + slot picker.

**Status:** ready-for-agent

- [ ] Starting checkout creates a hold; the slot renders as held everywhere and a visible countdown runs in the UI
- [ ] Checkout redirects to PayHere (sandbox) with correct amount in LKR rupees
- [ ] Success page shows booking ID, venue, court, date, time, amount, and QR code; confirmation email sent via Resend
- [ ] Hold expiry releases the slot automatically; abandoned checkout returns the slot to available
- [ ] Booking creation is idempotent via client key; a replayed submit cannot create two bookings

## Comments
Completed: 2026-08-19
