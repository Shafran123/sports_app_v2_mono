# 20 — Secret single-use QR tokens + owner scan check-in

**Status:** ready-for-agent
**Depends on:** 18 (admin control blocks availability), 19 (POS makes bookings)

## What to build
- Add `bookings.qr_token` (random secret, single-use) minted at booking creation (online, cash, and POS/walk-in).
- Player QR encodes the token (not the UUID). Update `booking-confirmation-page.tsx`.
- Owner console **Scan QR** camera view (mobile): scan → show booking details (venue, court, date, time, player name+phone, price, payment status, booking status) → owner taps **Check in** → token consumed, status `checked_in`.
- Re-scanning a consumed token → "already used."
- Check-in window: **from booking creation until end-of-slot +30min** (early arrivals OK). Replaces the current ±30min-around-slot rule.

## Acceptance
- [ ] Every booking has a `qr_token` (online, cash, POS)
- [ ] QR encodes the token, not the UUID
- [ ] Owner scans QR → sees full booking details (R5 list)
- [ ] Owner checks in → status `checked_in`, token consumed
- [ ] Re-scan of consumed token shows "already used"
- [ ] Early check-in allowed (before the slot) as long as booking exists; after end-of-slot +30min rejected
- [ ] Backend check-in accepts the token (new endpoint or extends existing) and validates ownership + window + single-use

## Notes
- DB: `bookings.qr_token text unique`. Migration; backfill existing confirmed bookings (generate tokens).
- Endpoint: `POST /business/bookings/check-in` currently takes booking id — add token-based lookup (`POST /business/qr-checkin` with `{ token }`), or accept `token` in the existing one.
- QR generation stays client-side (qrcode package already present).
- Idempotent: double check-in on same token returns "already used," not an error crash.