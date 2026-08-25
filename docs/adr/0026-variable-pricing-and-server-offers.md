# 0026 — Variable pricing and auto-applied server-side offers

- **Status:** accepted
- **Date:** 2026-08-24

## Context

A court has one fixed `price_per_slot`; every slot inherits it. Owners cannot charge more for peak times, and no discount/offer concept exists at all. ADR-0015 already established that discounts must be server rules — the client can never set a price. MVP scope explicitly deferred dynamic/peak pricing and promotions.

## Decision

Introduce two server-side mechanisms:

1. **Variable pricing** — `court_pricing_rules` rows `(court_id, day_of_week nullable, start_time, end_time, price_per_slot)`. A slot whose start falls inside a matching rule uses that rule's price; otherwise the court's base `price_per_slot`. If rules overlap, the **most specific wins** (matching `day_of_week` beats null; then the narrower window) — no save-time conflicts. Rule windows must fit inside an opening window for that day.

2. **Offers** — venue-wide (percentage or flat LKR off the whole booking) and slot-based (percentage or flat LKR off each matching slot, scoped to courts or all, by day-of-week + time window). Each offer has optional start/end dates plus an active toggle. Offers are **auto-applied server-side** (no codes). Stacking is **best single per kind** (best venue-wide + best slot-based, never compound), computed on the **peak-adjusted** price.

Tax math (ADR-0021) stays inclusive: the player pays the discounted total, and Platform + Venue Tax carve out of the reduced amount. Cancellation refunds (cancellation.js) base on the discounted amount actually paid. Offers apply to court Bookings only, never Event Registrations.

## Consequences

- Availability returns a price **per slot** (base + optional offer price); the player's total sums per-slot prices; checkout uses the same rule engine (`computeAmount`).
- Walk-in / quick-book dialogs auto-fill from the same engine, server-derived.
- Owner console gains a Pricing tab (per-court windows + base price) and an Offers tab (venue-wide and slot-based), alongside the Hours tab.