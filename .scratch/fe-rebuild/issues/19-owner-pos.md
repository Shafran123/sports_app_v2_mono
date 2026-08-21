# 19 — Owner quick-book POS (mobile-friendly walk-in booking)

**Status:** ready-for-agent
**Depends on:** 16 (cash), 17 (payment record)

## What to build
- Mobile-friendly quick-book in the owner console:
  - Pick a venue → pick a court → tap a slot → confirm.
  - Price defaulted from court; name/phone optional.
  - Supports **walk-in guests** (no user row; booking carries player_name/player_phone).
- Creates a confirmed cash booking (reuse `POST /business/bookings/manual` semantics) and a QR (see ticket 20).
- Owner can record payment immediately after.

## Acceptance
- [ ] Owner can book a slot in ≤3 taps on a phone
- [ ] Walk-in guest booking works with just name (phone optional)
- [ ] Resulting booking is confirmed cash and appears in Today timeline
- [ ] Owner can mark paid inline
- [ ] Overlap/slot conflicts rejected (same guard as manual booking)

## Notes
- Existing manual booking endpoint exists; this is the friendly UI + guest support. Consider whether manual booking should mint a QR token too (yes — same as any confirmed booking, ticket 20).
- Keep the hardcoded amount override for flexibility (owner may charge custom rate) but default to court price.