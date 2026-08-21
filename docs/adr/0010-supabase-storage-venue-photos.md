# ADR-0010 — Supabase Storage for venue photos

- **Status:** accepted
- **Date:** 2026-08-21

## Context
Venues have a `photos` column but no upload path — owners paste links. We want upload-at-create and edit-later with previews, matching ADR-0001 (Supabase for persistence).

## Decision
Store venue photos in a public Supabase Storage bucket `venue-photos`; the backend mediates uploads (authenticated) and stores the final URL in `venues.photos[]`. Public-read keeps the storefront/venue-detail simple (no per-request signing).

## Trade-offs
- Private bucket + signed URLs is more locked-down but adds signing latency and complexity for photos that aren't sensitive.
- Backend-mediated upload keeps auth in one place (the API already authenticates requests) vs. direct-to-bucket with signed policy.

## Consequences
- `venue-photos` public bucket + CORS configured.
- Venue create/edit UI gets pick → preview → upload (≤8, removable).
- `photos[]` holds public URLs rendered by the storefront.

## Current implementation (dev adapter)
Supabase Storage is not yet provisioned in this environment (dev DB is local Postgres), so the first implementation uses a **local-disk upload adapter** to keep the flow working end-to-end: `POST /api/v1/uploads` (auth'd, base64, PNG/JPG/WebP ≤8MB) writes to `sp_be/uploads/`, served statically at `/uploads/*`, and the returned URL is stored in `photos[]`. The storage seam is the URL in `photos[]`, so swapping to the Supabase public bucket later is a contained change (replace the upload handler, keep the bucket URL scheme).