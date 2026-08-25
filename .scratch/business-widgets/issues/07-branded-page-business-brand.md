# 07 — Branded Venue Page: business brand chrome

**What to build:** `myslot.lk/<slug>` keeps its per-venue URL and venue content, but its brand chrome (colors, logo, tagline) comes from the venue's **Business**, and the by-slug API joins that in.
- Backend: `GET /api/v1/venues/by-slug/:slug` response gains `business: { id, name, brand }` (one join on `venues.business_id`); keep returning the full venue + `widget_key`-free context (the branded page's BookPanel no longer receives a widget key — it sends no instance key; the page is single-venue).
- Page metadata: title stays venue-name-led; og tags/theme-color use Business brand tokens; header/tagline/logo render Business brand; venue name/photo/about/address stay venue-driven.
- Brand defaults: when `business.brand` is `{}` or partial, render platform defaults (same fallback the widget uses).
- Any remaining `widget_key` references in the user app are removed (no other consumer exists).
- Tests: by-slug response shape (business block present, absent for legacy rows → degraded), page renders business tokens, no venue step (see 06).

**Blocked by:** 02, 06

**Status:** ready-for-agent

- [ ] by-slug joins business; `{ business }` in response
- [ ] Branded page renders Business brand tokens with platform-default fallback
- [ ] `widget_key` references purged from user app
- [ ] Tests: by-slug shape + page rendering