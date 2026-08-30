# 12 — Marketplace retirement

**What to build:** the marketplace becomes customer-inaccessible with no further development (ADR-0045). Player app surfaces — browse, search, venue pages, marketplace checkout, player "my bookings" — route to a "marketplace closed — book on the venue's site" slate (or the landing page).

- Slate/redirect: all player-app marketplace routes → slate screen (branded, links out to the venue's site where resolvable); no dead links, no half-functional pages.
- Existing marketplace bookings play out: QR check-in works via the confirmation/reminder emails already sent; player self-cancel disappears (routes gone) — cancellation becomes owner/admin-assisted with the existing tiers via platform creds (05's legacy rule covers refunds).
- Marketplace checkout path stays in code (reachable by stale direct URL only); bookings through it use the platform gateway — no new development there.
- Admin console unchanged (ops surface, full visibility).

**Blocked by:** 05 (legacy refund resolution must exist first)

**Status:** ready-for-agent

- [ ] All player marketplace routes → slate; no dead UI states
- [ ] Legacy bookings still check in via email QR (no regression)
- [ ] Cancellation path for legacy bookings works owner/admin-assisted with tiers
- [ ] ADR-0045 referenced in CONTEXT.md retirement notes (Player, Marketplace Listing)