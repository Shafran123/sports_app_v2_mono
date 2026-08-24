# 01 — Restore venue card imagery (list API returns sport slugs)

**What to build:** venue cards on the home / explore / bookings surfaces render a glyph placeholder instead of an image after the storage migration. The venue **list** API must return sport slugs so the card's stock-imagery fallback resolves.

**Root cause:** `sp_be/controller/venueController.js` `listVenues` selects a fixed column list that omits `sports` (lines 160–163). `venueVisualSrc` (`packages/utils/src/imagery.ts`) only falls back to sport imagery when `venue.sports[0]` is a *slug*; with `sports` absent the card gets `null` → `VenueVisual` renders the emoji placeholder. Detail surfaces survive only because `venue-detail-page.tsx:64` falls back to `courts[0].sport_slug`, and events are unaffected (they carry `sport_slug`).

**Fix:**
- In `listVenues`, add a correlated subquery returning the venue's sport slugs as a JSON array, e.g.:
  ```sql
  coalesce(
    (select jsonb_agg(s.slug order by vs.sport_id)
     from venue_sports vs join sports s on s.id = vs.sport_id
     where vs.venue_id = v.id),
    '[]'::jsonb
  ) as sports
  ```
- No consumer on the list surface renders sport names (`VenueCard` only uses them for imagery), so returning slugs is safe.
- Do NOT change detail `sports` (venue-info.tsx renders names as chips) — detail imagery already works via the courts fallback.

**Blocked by:** —

**Status:** ready-for-agent

- [ ] `GET /api/v1/venues?limit=3` returns `sports` as slugs (e.g. `["badminton","futsal"]`)
- [ ] Home/explore venue cards render an image (sport stock photo when `photos` empty, real photo when present)
- [ ] Existing venue list tests updated/passing; add a test asserting `sports` is populated
- [ ] No regression on venue detail or event imagery