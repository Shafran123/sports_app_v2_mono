# 16 — Cash bookings: player checkout option + per-venue opt-in

**Status:** ready-for-agent
**Depends on:** 15 (spec)

## What to build
- Venues opt in per venue: owner setting "accept pay-at-venue (cash)" (default off). Only venues with the toggle show the cash option.
- Checkout page: payment method choice **PayHere** or **Pay at venue**. Choosing cash creates the booking confirmed immediately (`payment_method=cash`), no PayHere redirect, no hold needed (or short hold — see note).
- Player confirmation shows the QR + "pay Rs X on arrival" instead of a PayHere redirect.
- Cash bookings are free to cancel; slot released, nothing to refund.

## Acceptance
- [ ] Venue create/edit has the "accept cash" toggle (owner)
- [ ] A venue without the toggle never shows the cash option to players
- [ ] Checkout offers PayHere vs Pay-at-venue; cash path creates a confirmed booking with `payment_method=cash`
- [ ] Cash booking appears in player bookings with "pay on arrival" state
- [ ] Cancelling a cash booking releases the slot; no refund action

## Notes
- DB: `venues.payment_methods` jsonb or a boolean `accepts_cash` (decide in impl; keep it explicit). `bookings.payment_method` already exists (`online`/`cash`).
- A cash checkout should probably still create a hold then confirm on webhook-free path — simplest is: cash checkout inserts booking directly (confirmed) after overlap checks, no `payments` row yet (that's ticket 17).
- Mirrors existing `POST /business/bookings/manual` overlap logic.