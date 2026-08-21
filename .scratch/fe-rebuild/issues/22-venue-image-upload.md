# 22 — Venue image upload (Supabase Storage)

**Status:** ready-for-agent
**Depends on:** 15 (spec), Supabase Storage configured (ADR-0010)

## What to build
- Venue create/edit: **upload photos** instead of pasting links.
- Pick → preview → upload (multi-select, drag-drop, preview grid, remove before save). Optional, ≤8.
- Public Supabase Storage bucket `venue-photos`; store the final URL in `venues.photos[]`.
- Editable later via venue settings.

## Acceptance
- [ ] Owner can upload photos at venue creation
- [ ] Owner can edit/remove photos later from venue settings
- [ ] Max 8; previews shown; remove before save works
- [ ] URLs persist in `photos[]` and render on the storefront/venue detail
- [ ] Backend accepts photo URLs from upload (or a dedicated upload endpoint writes to storage)

## Notes
- Depends on Supabase Storage being reachable from the backend (service-account creds) or a frontend direct-to-bucket upload with signed policy. Prefer backend-mediated upload for simplicity + auth.
- Add `venue-photos` public bucket + CORS.
- Keep the photos text[]/jsonb shape already in the schema.