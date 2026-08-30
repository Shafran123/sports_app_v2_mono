# 0045 — Marketplace retirement

**Status:** accepted

## Context

Per-business payment gateways (ADR-0044) put booking money in the owner's account, and the product is now owned by venue-branded surfaces (Dedicated Site, Booking Widget) with the Owner Plan as the commercial model. The marketplace (player app browse/search/book across all venues) no longer has a customer audience — a player-facing marketplace that only surfaces site-bound venues is a dead channel. It also forces the platform PayHere gateway to keep serving customer bookings, which ADR-0044 wants to end.

## Decision

The marketplace becomes **customer-inaccessible with no further development**: all player-app surfaces (browse, search, venue pages, marketplace checkout, player "my bookings") route to a "marketplace closed — book on the venue's site" slate (or the landing page). Admin console access is unchanged — it is the ops surface, not the marketplace.

- Existing marketplace bookings play out: players check in via the QR in their confirmation/reminder emails (already sent today); self-cancel UI disappears, so cancellation becomes owner/admin-assisted, with the cancellation tiers still applying via platform credentials.
- The marketplace checkout path stays in code but is not advertised; bookings made through a stale direct URL use the platform gateway (covered by ADR-0044's legacy rule).
- The platform PayHere gateway survives for **Events and legacy refunds only**. All new customer bookings flow through per-business gateways.

## Trade-offs

- **Hide-by-slate vs hard delete**: keeping the code and the platform gateway avoids a big-bang removal while the site/widget flows are proven; the slate makes the closure explicit to any stragglers.
- **Player "my bookings" removed**: QR access already reaches players by email/SMS (widget players never had the app), so losing the in-app booking list costs little — and removes the only remaining platform-credentialed customer surface.

## Consequences

- Player app: marketplace routes → slate redirect; no new marketplace development.
- Cancellation for legacy marketplace bookings: owner/admin-assisted, platform tiers, platform credentials.
- CONTEXT.md: **Marketplace Listing**, **Player** glossary entries marked retired; marketplace language swept from Booking/Payment entries.
- ADR-0044's credential-resolution rule covers legacy refunds; this ADR records why the marketplace is gone so nobody re-activates it without revisiting the gateway model.