# 09 — Venue detail + booking flow fully branded (ADR 0031)

**What to build:** On the site host, the venue detail page (photos, courts/availability, pricing) and the booking flow (sign-in, checkout, holds, QR, my-bookings) render in full **Site Brand** chrome and colors — no marketplace styling visible anywhere on the site. Brand CSS variables already flow (primary/accent); wire them through the detail page, checkout, and success/QR surfaces, and keep the persistent "Switch venue" control. The marketplace-styled surfaces remain only off-site.

**Blocked by:** 08

**Status:** ready-for-agent

- [x] Venue detail page on the site host uses brand colors + site chrome end to end
- [x] Checkout, payment step, and success/QR screens on the site host use brand colors
- [x] "Switch venue" control persists on branded venue pages
- [x] My-bookings surface on the site for the signed-in Site Customer
- [x] Tests: rendered pages carry brand colors on site host; marketplace host unchanged