# 06 — Branded venue page (hosted)

**What to build:** the white-labeled storefront at `myslot.lk/<slug>` — venue name, brand tokens (colors, logo, tagline, photos, about with platform defaults), court list with **live** prices from Court/Variable Pricing config (never re-entered), opening hours, and the full booking flow inline. Public and indexable; one venue per URL (portfolio pages are v2). Built by white-labeling the existing booking engine, not a new stack.

**Blocked by:** 01 (visibility — where the page is reachable from), 04 (the flow it embeds).

**Status:** ready-for-agent

- [ ] Route `myslot.lk/<slug>` renders a venue page; slug auto-derived from name, unique, admin-editable
- [ ] Brand tokens render; defaults when unset; prices/availability read live from venue config
- [ ] Booking flow inline on the page (same engine as the widget)
- [ ] Public + indexable; private venues are reachable here but nowhere in-app
- [ ] Tests: slug uniqueness, brand-token fallback, live price sync, private venue page reachable + not in app