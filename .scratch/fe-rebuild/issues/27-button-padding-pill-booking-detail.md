# 27 — Button padding + pill selected state + booking detail/QR sheet

**Status:** ready-for-agent
**Depends on:** 24 (spec)

## What to build
1. **Button component** (`packages/ui/src/components/ui/button.tsx`):
   - Enforce horizontal padding on every size; add a `block`/full-width size (or `w-full` convenience) so no button renders bare.
   - Sweep call sites that pass `px-0`/`px-1` or rely on content-only padding; fix the ones that were flagged (buttons with no left/right padding).
2. **Pill selected state**: audit all selectable pills (tabs, home sport chips, venue date strip, slot pills, status pills) and make the selected state unambiguous (fill + contrast), not just a border.
3. **Player booking detail + QR** (`bookings-list.tsx`):
   - Make each booking row tappable → opens a **detail bottom sheet** (mobile) / dialog (desktop) showing status, time, price, payment method, booking ID, and the **QR code** rendered inline from `qr_token` (reuse `qrcode` as in the confirmation page), plus a "View venue" link.
   - Also show QR from a "view" button if present on the confirmation page.

## Acceptance
- [ ] No button renders without horizontal padding; full-width variant works
- [ ] Every selectable pill shows a clear selected state (fill/contrast)
- [ ] Tapping a booking in the player's list opens details with the QR code
- [ ] QR renders from `qr_token`; "View venue" navigates to the venue
- [ ] Bottom sheet on mobile, dialog on desktop