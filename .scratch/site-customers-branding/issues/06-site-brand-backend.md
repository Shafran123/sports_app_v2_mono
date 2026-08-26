# 06 — Site Brand backend: brand JSONB extension (ADR 0031)

**What to build:** Extend the Business `brand` JSONB: shared tokens stay (name, colors, logo, tagline) plus site-only fields — hero image, hero headline/caption, longer about, and a contact block (phone, email, address, hours). Extend `sanitizeBrand` (currently drops unknown keys, caps about at 120 chars): allow the new keys, raise the about cap (≈500), validate hero as upload URL or https URL, validate contact block. `POST /api/v1/uploads` already exists (Supabase Storage); logo gains upload support too with URL fallback. No preview button.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [x] `sanitizeBrand` allows `hero_image`, `headline`, `about` (≈500 cap), `contact {phone,email,address,hours}`; keeps colors/logo/tagline rules
- [x] Owner `PATCH /api/v1/business/me` round-trips the new fields; validation rejects bad URLs/shape
- [x] Logo upload path (existing uploads endpoint) wired for the brand editor; hero upload + URL fallback
- [x] Public site payload (`GET /api/v1/public/site/by-hostname`) returns the extended brand
- [x] Types (`packages/types` BrandSchema) + API client updated
- [x] Tests: sanitize/validate new fields, upload/URL round-trip, overlong about rejected