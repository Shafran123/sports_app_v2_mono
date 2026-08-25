# Offers not reflecting on the player side — diagnosis + fix

Status: ready-for-agent

## Problem Statement

Venue owners can create offers (venue-wide and slot-based) from the owner console, but they do not appear to players at all: slot prices show full price with no discount, the selection summary/CTA show the base total, and checkout displays the base total even though the server charges a discounted amount.

Verified by a red-capable probe: a 20% slot offer created by the owner produced an availability payload of `price: 1500, offer_price: null`.

## Root Cause

The availability endpoint's courts query does not select `c.venue_id`:

```
select c.id, c.name, c.price_per_slot, c.slot_duration_min, s.name as sport
from courts c left join sports s on s.id = c.sport_id
```

`slotPricing` therefore calls `slotOffersForVenue(court.venue_id = undefined)`, and the SQL `where venue_id = $1` becomes `venue_id = NULL`, which never matches. So **slot-based offers never apply on the player side**. The pricing engine itself is correct — it is fed a court without its `venue_id`.

Two downstream display bugs compound it:

- `summarizeSelection` sums `slot.price` (base) and ignores `slot.offer_price`, so the summary badge, CTA, and checkout link all carry the base price.
- The checkout page shows `slotsCount × pricePerSlot` (base, from the URL) as the Total, never the server's discounted `result.amount`.

And one by-design gap: venue-wide offers only apply at checkout, so they are invisible to the player before checkout.

## Solution

1. **Backend** — the availability courts query selects `c.venue_id` (and the pricing engine receives a court with its venue id), so `slotOffersForVenue` matches the venue's offers. Slot offers then surface as `offer_price` on each matching slot.
2. **Player selection** — `summarizeSelection` sums `slot.offer_price ?? slot.price ?? court.price_per_slot`, and `buildCtaHref` carries the discounted per-slot price, so the summary badge, CTA, and checkout link reflect the discount.
3. **Checkout** — the Total renders the server's `result.amount`; when a discount applies, show a "You saved Rs X" line and the pre-discount total struck through. The Rate line may still show base × duration but the Total must match what the server charges.
4. **Venue-wide offers** — a badge in the "Book a slot" header when any venue-wide offer is active (e.g. "20% off today"), so players see it before checkout. Offer applies only at checkout (unchanged).

## User Stories

1. As a player, I see a discounted price (strikethrough + offer price) on slots that match a slot-based offer.
2. As a player, my selection summary and the "Continue · Rs X" button reflect the discounted total.
3. As a player, the checkout Total matches what I actually pay, and I can see how much I saved.
4. As a player, I can see that a venue-wide offer is active on the venue before I start booking.
5. As a venue owner, a slot offer with no courts selected applies to all courts of the venue.

## Implementation Decisions

- The pricing engine is already correct; the fix is feeding it the court's `venue_id`.
- `offer_price` remains `null` when no offer applies (backwards compatible — the old client still renders).
- Venue-wide offers are not shown per-slot (they discount the whole booking); only the header badge surfaces them pre-checkout.
- The checkout "you saved" line is derived from `base total − result.amount` when positive.

## Testing Decisions

- Backend: a test creates a slot offer then asserts an available slot in `/venues/:id/availability` returns `price` (base) and `offer_price` (discounted). This is the exact probe that went red; it becomes the regression test.
- Frontend: `selection.test.ts` asserts `summarizeSelection` totals use `offer_price` when present; a checkout test asserts the Total renders `result.amount`.

## Out of Scope

- Offer stacking changes (best-per-kind stays).
- Promo codes.
- Recurring offers.
