# 03 — Widget Instance CRUD (backend + console API)

**What to build:** The `widget_instances` service and its owner-console API; the venue-level widget settings endpoints (`GET/PATCH /business/venues/:id/widget`) are replaced by instance endpoints.
- Service (`services/widgetInstances.js`): `listForBusiness(businessId)` (join venue names + status for the instance list), `getById`, `create(businessId, { name, defaultVenueId, allowVenueChoice, allowedDomains })`, `update(id, businessId, patch)`, `setEnabled`, `delete` (cascade keeps bookings intact — instances are presentation; deleting one must not touch bookings).
- Validation: `name` required ≤ 60 chars; `defaultVenueId` must be an approved venue of the same Business (query `venues` join); `allowVenueChoice` boolean; `allowedDomains` via existing `sanitizeDomains` (≤10 host[:port]).
- Embed key: mint on create via the existing `mintWidgetKey` (32-hex). No key reuse ever; no key regeneration endpoint (keys are stable identifiers).
- Default-venue fallback helper: `eligibleVenues(businessId)` = approved venues of the business (incl. private, excl. suspended/banned/archived); `resolveEffectiveScope(instance)` → `{ defaultVenue?, allowChoice, venues }` where a non-approved default degrades to `defaultVenue: null` + `allowChoice` forced true (never a dead embed).
- Owner console API in `sp_be/routes/business.js` (all ownership-checked via `business_id`):
  - `GET /business/widget-instances` → list with venue names/status
  - `POST /business/widget-instances` → create (mints key)
  - `PATCH /business/widget-instances/:id` → update fields/enable/disable
  - `DELETE /business/widget-instances/:id`
  - `GET /business/widget-instances/:id` → full instance + eligible venues (for the editor)
- Soft-delete vs hard-delete: hard delete (embeds 404). Bookings unaffected.
- Tests: ownership, eligible-venue exclusions, default-venue degradation, sanitization.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `services/widgetInstances.js` (list/get/create/update/delete/setEnabled)
- [ ] Eligible-venue + effective-scope helpers with degradation fallback
- [ ] Console CRUD endpoints with ownership checks
- [ ] Embed key mint on create (no reuse)
- [ ] Unit tests (ownership, eligibility, degradation, sanitization)