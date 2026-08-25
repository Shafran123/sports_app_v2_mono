# Venue Hours, Variable Pricing, and Offers

Status: ready-for-agent

## Problem Statement

Venue owners are boxed into a single opening-hours shape, a single price, and no promotional tooling:

1. **One window per day** — `venue_hours` enforces a single open→close pair per `(venue_id, day_of_week)`, so a venue with a mid-day closure (09:00–12:00, then 14:00–23:00) cannot express it. Availability and checkout read only the first row of the day, so split days are structurally impossible.
2. **One price per court** — every slot on a court inherits its single `price_per_slot`. Owners cannot charge more for peak hours or less for off-peak. There is no "pricing rules" concept at all.
3. **No offers** — no table, route, or field for discounts, offers, coupons, or promos. A venue cannot run a weekend promotion or an off-peak discount. ADR-0015 already says discounts must be server rules; MVP scope deferred it.
4. **Hardcoded booking horizon** — the player can book 14 days ahead (platform `advance_days`, frontend hardcodes `DAY_COUNT = 14`). Owners cannot configure how far ahead they accept bookings, and 14 days is fixed.
5. **Booking flow friction** — the player-facing flow shows every slot in a long strip; there is no "how many hours" control, and the "too many time slots" layout confuses users.

## Solution

Introduce four owner-facing capabilities and one player-facing flow, all sharing a single server-side pricing engine.

### 1. Multi-window opening hours

- A venue has **Opening Windows**: several contiguous open→close periods per day (e.g. 09:00–12:00 and 14:00–23:00). A day with no windows is closed.
- Server-side validation: windows on the same day must not overlap.
- Availability and checkout iterate **all** windows for the day, not the first row.
- A booking (one or more consecutive Slots) must fit entirely inside **one** Opening Window; it never spans a gap.
- Owner Hours editor becomes a per-day list of windows (add/remove, "copy day to week").
- Existing rows (one window per day) read as-is — a single window is the degenerate case.

### 2. Closed dates

- New `venue_closed_dates` (venue_id, date, optional reason) — one-off dates only; recurring weekly closure lives in Opening Windows.
- On a Closed Date the venue shows no availability, checkout rejects it, and pricing/offer rules for that day don't apply.
- Existing confirmed Bookings on a Closed Date **stay** — the owner cancels them manually if needed.

### 3. Owner-configurable advance horizon

- New `venues.advance_days` — **0 = unlimited**, no admin cap. Availability + booking read the venue value, falling back to platform `advance_days`.
- The client builds the date picker from the venue's effective horizon; past dates and dates beyond the horizon are unselectable. The server stays authoritative — a date beyond the horizon returns no availability.

### 4. Variable pricing (peak/off-peak)

- New `court_pricing_rules` rows: `(court_id, day_of_week nullable, start_time, end_time, price_per_slot)`.
- A slot whose start falls inside a matching rule uses that rule's price; otherwise the court's base `price_per_slot`.
- Overlapping rules: **most specific wins** (matching `day_of_week` beats null; then the narrower window). No save-time conflict errors.
- Rule windows must fit inside an Opening Window for that day.
- The player's total sums **per-slot** prices, not `count × base price`.

### 5. Offers

- Venue-wide offer: percentage or flat LKR off the **whole booking**.
- Slot-based offer: percentage or flat LKR off **each matching slot**, scoped to one or more Courts by day+time window.
- Each offer has optional start/end dates + an active toggle. Auto-applied server-side, no codes.
- Stacking: **best single per kind** — the best venue-wide offer plus the best slot-based offer, never compounding.
- Offers apply to court Bookings only, **never Event Registrations**.
- The discount computes on the **peak-adjusted** price; the player pays the discounted total; Platform Tax + Venue Tax carve out of the discounted amount (inclusive tax math, ADR-0021).
- Cancellation refunds base on the discounted amount actually paid.
- Player sees a badge + struck-through price on matching slots; the server owns the calculation.

### 6. Reworked booking flow (player)

- New flow: **Court → date → duration chips → slot start-times**.
- Date picker replaces the 14-day strip, bounded by the venue's `advance_days` (0 = unlimited; client calendar finite, server authoritative).
- Duration chips derive from the court's `slot_duration_min` (30/60), capped at `MAX_SLOTS` (8) and at the remaining window. Tapping an available start auto-highlights the run of the chosen duration.
- Runs never span a Closed Date, a closed gap, or a past slot. Court cards show sport, price **range** (base–peak), and duration chips; disabled when fully booked.
- Walk-in / quick-book dialogs auto-fill from the same pricing + offers engine, server-validated.

## User Stories

1. As a venue owner, I can set several opening windows per day (e.g. 09:00–12:00 and 14:00–23:00), so I can express a mid-day closure without being forced into one continuous day.
2. As a venue owner, I can add/remove windows per day and copy one day's pattern to the rest of the week, so I don't configure each day manually.
3. As a player, I can see all the day's open windows on the venue detail page, so I know when I can book.
4. As a venue owner, I can mark specific dates closed (holidays, maintenance), so players can't book those days.
5. As a player, I never see slots on a closed date, so I don't attempt a booking that can't happen.
6. As a venue owner, I can configure my own advance-booking horizon (days ahead, or 0 = unlimited), so I control how far out players can book.
7. As a venue owner, I can set different prices for different day/time windows on a court (peak vs off-peak), so I can charge more for peak hours and less for quiet ones.
8. As a venue owner, I can see a court's price range on its card, so players see the spread.
9. As a player, I can pick a court, then a date, then a duration, then see only that court's available start times for that date, so the picker isn't a wall of slots.
10. As a player, I can see each slot's exact price (with the offer discount marked), so I know what I'll pay before selecting.
11. As a venue owner, I can create a venue-wide percentage or flat offer, so I can run a weekend promotion.
12. As a venue owner, I can create a slot-based offer scoped to specific courts/time windows, so I can discount off-peak or specific courts.
13. As a venue owner, I can set start/end dates and an active toggle on an offer, so I can schedule a campaign and not worry about it lingering.
14. As a player, matching offers are auto-applied at checkout — no codes — so I get the discount without hunting for a promo.
15. As a player, I never see a slot that started in the past for today's date, so I don't try to book something already gone.
16. As a player, I can book a run of consecutive slots of exactly my chosen duration, and I can't book a run that spans a closed gap.
17. As a venue owner, when I mark a date closed, existing confirmed bookings on that date are left alone — I cancel them myself if needed.
18. As a venue owner, walk-in and quick-book dialogs auto-fill from the same pricing + offers engine, so the price a walk-in pays matches what the app would quote.
19. As a player, the discount is applied on the peak-adjusted price, so a % off-peak offer on a peak-priced slot takes the % off the peak price.

## Implementation Decisions

- **One server-side pricing engine** — a pure function `(court, date, slot range, opening windows, pricing rules, offers, tax rates) → per-slot {base, offer, payable} + totals`. Called by availability, checkout, and walk-in. Single source of truth for price, discounts, and tax. Mirrors ADR-0015 ("discounts must be server rules").
- **One window/closure resolver** — computes a date's effective window set (opening windows − closed dates), used by the engine and availability. No slot ever spans a gap.
- **Shared Zod schemas + typed API client** (`packages/types`, `packages/api`) — the new shapes (multi-window, per-slot price, closed dates, offers, `advance_days`) land here so backend and both apps compile against one contract.
- **Schema changes**: drop the `unique (venue_id, day_of_week)` constraint on `venue_hours`; add `venues.advance_days` (int, default 0); add `venue_closed_dates`, `court_pricing_rules`, `offers` tables.
- **Offer stacking rule**: best-single-per-kind — the best venue-wide offer plus the best slot-based offer, never compounding.
- **Overlap rule**: most-specific-wins for pricing rules (matching day_of_week > null; narrower window wins). No save-time conflict errors.
- **Tax math**: unchanged inclusive (ADR-0021), but the discount comes off the total first; Platform Tax + Venue Tax split out of the discounted amount.

## Testing Decisions

- Backend: `sp_be/test/availability.test.js` (availability), `bookingFlow.test.js` (checkout/booking), `inclusiveTax.test.js`/`taxEngine.test.js` (tax math) — the new engine and window/closure resolver get unit tests against those prior patterns.
- Frontend: `selection.test.ts`, `checkout-page.test.tsx`, and the slot-picker tests — the reworked booking flow and court cards get component tests.
- The seams for testing are the same as the implementation seams: the engine and the window/closure resolver are pure functions, so they're unit-testable in isolation; the API and UI layers are integration tests against those.
- A good test for this feature asserts external behaviour (a slot's availability, a booking's total, an offer's application), not internal helpers.

## Out of Scope

- Recurring bookings (explicitly out of scope for the MVP).
- Coupons / promo codes — offers are auto-applied server-side, no codes.
- Offers on Event Registrations — court Bookings only.
- Automated expiry enforcement for offers (optional start/end dates; the toggle is manual).
- Admin-set platform cap on `advance_days`.

## Further Notes

- The `venue_hours` unique constraint removal affects `venueController.createVenue` (inserts), `businessController.updateVenueHours` (delete-all + reinsert), and both availability + booking window reads.
- The availability endpoint and checkout must both be revalidated as one unit when the engine flips.
- The frontend booking flow touches `apps/user/src/features/venue-detail/` (date-strip, slot-picker, selection) and `apps/user/src/features/checkout/`.
- Owner-side UI touches `apps/admin/src/features/admin-venues/` (venue-detail-page Hours tab, new Pricing/Offers tabs).
- `.scratch/` directory: `venue-hours-pricing-offers`.