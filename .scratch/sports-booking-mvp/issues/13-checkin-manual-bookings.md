# 13 — Check-in + manual bookings

**What to build:** venue staff scan a booking's QR code from the mobile `/business` dashboard; the check-in endpoint validates venue, date, time window (±30 min), and state before moving the booking to CHECKED_IN. Owners can also create manual bookings marked cash-paid (phone callers/walk-ins), which block the slot online.

**Blocked by:** 07 — Business shell + court management; 09 — Booking flow (hold → pay → QR).

**Status:** ready-for-agent

- [ ] QR scan in `/business` (device camera) decodes the booking ID and calls check-in validation
- [ ] Check-in succeeds only for the correct venue, within the time window, in a confirmed state; failures show the reason
- [ ] Successful check-in records time and moves the booking to CHECKED_IN
- [ ] Manual booking form (player name/phone, court, slot, cash amount) creates a paid booking that blocks the slot online
- [ ] Checked-in and cash bookings appear correctly in the owner calendar (ticket 12's views)

## Comments
Completed: 2026-08-19
