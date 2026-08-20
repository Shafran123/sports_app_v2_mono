# 05 — Venue discovery

**What to build:** players can find venues. The home page, venue list, and venue detail page (photos, address, map, amenities, rules, cancellation policy, courts with sports and prices) work from real Postgres data with city, sport, name search and sport/price/indoor-outdoor filters. The old "Yard" pages are replaced.

**Blocked by:** 02 — Supabase schema + seed; 04 — Auth & profiles.

**Status:** ready-for-agent

- [ ] Public venue list endpoint supports search (name, sport, city) and filters (sport, price range, indoor/outdoor) with pagination
- [ ] Venue detail endpoint returns courts with sport, capacity, price, slot duration, indoor/outdoor
- [ ] Home page shows nearby venues with image, distance, starting price; venue list and venue detail pages render real seeded data
- [ ] Every page has loading, empty, and error states
- [ ] Browsing requires no login

## Comments
Completed: 2026-08-19
