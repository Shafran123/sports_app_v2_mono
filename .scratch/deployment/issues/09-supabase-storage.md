# 09 — Uploads: supersede Railway volume with Supabase Storage (ADR-0010)

Type: task
Status: wontfix (superseded)

> **SUPERSEDED 2026-08-23** — implemented in `.scratch/supabase-storage/` (ticket 01, spec.md). Bucket `venue_images`, backend proxy uploads, orphan deletion, migration 0014, `/uploads` stack removed. This ticket's checklist is now covered there; kept for history.

## Context

Pre-prod stores venue photos on the Railway volume (decision Q5/Q8 — pragmatic first step). ADR-0010 ("Supabase Storage for venue photos") is the intended end state: images survive even if the volume is destroyed and uploads no longer depend on Railway's filesystem.

## Deliverables

- Rewrite `sp_be/routes/uploads.js` to write to a Supabase Storage bucket and return absolute public URLs (ADR-0010).
- Backfill: copy current volume content into the bucket; keep serving `/uploads/*` paths that already exist in venue `photos[]` (or run a one-shot backfill migration rewriting stored photo URLs).
- Front-end: no change expected (URLs flow through the API), verify both apps render bucket URLs.
- Drop the Railway volume reference from ticket 04's checklist; update docs/adr/0010 status if fulfilled.
- Declare the volume obsolete in the deploy docs once verified.

## Done

- [ ] Uploads land in the bucket; legacy photos migrated or still 200 via shim; builds + tests green.

Blocked by: 07