# 05 — Venue-wide offers

**What to build:** Venue owners create a venue-wide offer — a percentage or flat LKR discount off the whole booking — with optional start/end dates and an active toggle. The server auto-applies the best eligible venue-wide offer at checkout (no codes). The discount comes off the peak-adjusted total first, then Platform Tax and Venue Tax split out of the discounted amount (inclusive tax math, ADR-0021). Offers apply to court Bookings only, never Event Registrations. Cancellation refunds base on the discounted amount the player actually paid.

**Blocked by:** 04 — Variable pricing

**Status:** ready-for-agent

- [ ] Owner creates, edits, and deactivates a venue-wide offer (percentage or flat, start/end dates, active toggle).
- [ ] The server auto-applies the best eligible venue-wide offer at checkout — no promo code required.
- [ ] The discount computes on the peak-adjusted subtotal, before tax split.
- [ ] Platform Tax and Venue Tax carve out of the discounted amount.
- [ ] Event Registrations are never discounted by a venue offer.
- [ ] A cancellation refund bases on the discounted amount actually paid.
- [ ] Expired offers (past end date) and inactive offers never apply.