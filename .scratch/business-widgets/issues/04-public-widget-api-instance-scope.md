# 04 — Public widget API re-scoped to instances

**What to build:** `GET /api/v1/public/widget/:key/config` resolves the `key` as a Widget Instance (not a venue) and returns business-scoped data. `phone/send` and `phone/confirm` keep their key-based resolution but through the same instance lookup (their venue-agnostic payloads already work once the key resolves).
- `venueByWidgetKey` → `instanceByEmbedKey`: query `widget_instances` joined to `businesses` and approved venues of that business; require `enabled = true`.
- Origin enforcement: same `isHostAllowed` against the **instance's** `allowed_domains`; an instance with `enabled=false` or empty allowlist with a disclosed parent origin behaves like today (allowlist only blocks a disclosed non-allowed origin; no origin → allowed, direct-open behavior).
- Config response shape (per instance + business):
  - business: `{ id, name, brand }`
  - instance: `{ name, defaultVenueId, allowVenueChoice, allowed_domains: false (never exposed) }`
  - venues: `[{ id, name, slug, address, photos, courts, sports, hours, brand-less }]` — exactly the eligible set (approved venues of the business, private included); each venue carries its courts/slots data as today (the response keeps the existing per-venue fields so the client's venue step can render).
  - When `allowVenueChoice` is false, `venues` may still contain 1+ venues (the *client* hides the step because a single bookable venue can be derived from defaultVenueId) — server-side truth lives at checkout (see 05).
- 404 for unknown/disabled keys (no existence leak, same as today). Remove `WIDGET_NOT_FOUND` wording that implies venue.
- Update `sp_be/utils/widget.js` helpers (`mintWidgetKey` stays; add instance-lookup) and `widgetController.js`; keep `isHostAllowed` usage.
- Tests: config for enabled instance (brand + venues + defaults), disabled instance → 404, non-allowed origin → 403, key of an old venue (no instance) → 404.

**Blocked by:** 02, 03

**Status:** ready-for-agent

- [ ] Instance-based key resolution in widgetController
- [ ] Config payload: business brand + eligible venues + instance defaults
- [ ] 404/403 behavior preserved (unknown key, disabled instance, bad origin)
- [ ] phone/send + phone/confirm resolve via instance lookup
- [ ] Unit tests (config shape, enable/disable, origin, legacy-key 404)