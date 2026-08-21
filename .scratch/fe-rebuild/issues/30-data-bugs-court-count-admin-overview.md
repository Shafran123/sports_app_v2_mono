# 30 — Data bugs: owner "0 courts" + admin sales data

**Status:** ready-for-agent
**Depends on:** 24 (spec)

## What to build
1. **Owner "0 courts"** — root cause: `venues.mine()` in `packages/api/src/index.ts` parses with `VenueSchema`, which **strips `court_count`** (zod drops unknown keys) before `venue-api.ts`/`venues-page.tsx` can read it. So owner venue cards always fall back to `?? 0`.
   - Fix: keep `court_count`/`courts_count` through the API layer (add to the parse schema, or make `mine()` return a schema that includes `court_count`). Confirm against the backend response which field it is (`court_count`).
   - Owner venue cards and front-desk venues list should show real counts (API returns correct 2/2/3 etc.).
2. **Admin sales data wrong** — the admin dashboard shows LKR 0 / 0 because the `overview` query is `enabled: !!user && !isAdmin` (admins never fetch it).
   - Add backend `GET /api/v1/admin/overview` → `{ revenue_today, bookings_today, total_venues, pending_approvals }` (platform-wide, from paid payments + bookings + venues counts, pending = venues with status `pending`).
   - Wire the admin dashboard to render these real numbers.

## Acceptance
- [ ] Owner venue cards show the correct court count (not 0)
- [ ] Admin dashboard shows real revenue today, bookings today, total venues, pending approvals (no LKR 0)
- [ ] Backend `GET /api/v1/admin/overview` returns platform-wide numbers
- [ ] Existing owner `overview` behavior unchanged (only owner venues)