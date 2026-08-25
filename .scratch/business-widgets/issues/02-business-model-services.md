# 02 — Business model + services (backend)

**What to build:** A Business persistence layer in `sp_be` replacing the venue-level widget settings.
- Model/service (e.g. `services/businesses.js`): `getByOwnerId(ownerId)` (throws/marks if none — though migration guarantees one), `getById`, `updateBrand(businessId, ownerId, brand)` using the existing `sanitizeBrand` from `utils/widget.js` (hex colors, ≤80 tagline, ≤120 about, https logo), `updateName` (same limits as venue names).
- Ownership helper: `getOwnedBusinessId(userId)` used by business-scoped routes; keywords on `owner_id` only.
- Venue ↔ business linkage is read via the existing `venues.owner_id` where convenient, but all new widget/instance reads go through `businesses.business_id` — cross-check both stay consistent (single source: `business_id` on venues).
- Expose in the owner console API: `GET /api/v1/business/me` → `{ id, name, brand, venues: [{ id, name, status, visibility, slug }] }` (venues list consumed by the Widget & site page and instance editors); `PATCH /api/v1/business/me` for `{ name?, brand? }` with ownership verification.
- Routes: mount under `sp_be/routes/business.js` alongside the existing `/business/*` group, owner session required.
- Tests: ownership boundary (owner A cannot read/update owner B's business), brand sanitization, name limits.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `services/businesses.js` with getByOwnerId/getById/updateBrand/updateName
- [ ] `GET /business/me` + `PATCH /business/me` with ownership checks
- [ ] Brand + name sanitization reused from `utils/widget.js`
- [ ] Unit tests (ownership, sanitization)