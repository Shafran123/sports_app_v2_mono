# 10 — Marketplace default-off at site-live + owner opt-back-in (ADR 0031)

**What to build:** When a Business's Dedicated Site goes live, its venues **default off the marketplace** — hidden from marketplace booking — and sell only on the site (ADR-0031). The owner can per-venue opt back **into** a **Marketplace Listing** (dual-channel: site + marketplace in parallel) and turn it off again, via the Owner Console. Venues without a live site keep their marketplace listing by default. The existing visibility flag still governs marketplace *discovery*; this state governs whether a site-live venue sells on the marketplace at all. Existing confirmed bookings on the marketplace continue to play out unaffected.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [x] Migration: `venues.marketplace_listing boolean default true` (or derived state); site-live flips the Business's venue defaults off
- [x] Marketplace browse/booking queries exclude site-live venues whose listing is off; link-out to the site instead
- [x] Owner Console: per-venue Marketplace Listing toggle (on/off), visible for site-live Businesses, with the site-first default surfaced
- [x] Site-live flip is idempotent and does not touch confirmed marketplace bookings
- [x] Tests: default-off at site-live, opt-in dual-channel, opt-out, non-site Businesses unaffected