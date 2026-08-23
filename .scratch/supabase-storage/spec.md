# Supabase Storage for Venue Photos (migration off the Railway volume)

Status: ready-for-agent

## Problem Statement

Venue photos currently live on the Railway instance disk (`sp_be/uploads/`), mounted as a volume at `/app/sp_be/uploads`. This is the failure that started this effort: the three seed venues' photos vanished from the instance (`404` on `/uploads/cd03e6ff-…jpg`, `/uploads/f69ffc34-…jpeg`, `/uploads/58da0428-…jpg` — the files are gone and unrecoverable; the DB still holds the URLs). The volume path is also mis-wired (app runs at `/app/*` while uploads are written to `/app/uploads`, so redeploys wipe them), and disk storage is ephemeral by design. ADR-0010 ("Supabase Storage for venue photos") is the intended end state; this effort implements it.

## Current State (verified)

- Live backend: `https://sportsappv2mono-production.up.railway.app`, Postgres = Supabase project `jxhhlwgwcarhhujhwctv` (`DATABASE_URL` in `sp_be/.env`).
- **Bucket already exists**: `venue_images` (public, per grill Q1), empty. This is the target.
- **No Supabase code anywhere**: no CLI/MCP/credentials on this machine or in the repo; `sp_be` talks Postgres via `pg` only. Node built-in `fetch` is already used for outbound HTTP (`utils/emailService.js`, `utils/smsService.js`).
- Upload route: `sp_be/routes/uploads.js` (base64 body, magic-byte check, `fs.writeFileSync`, returns `/uploads/<uuid>.<ext>`); mounted at `/api/v1/uploads` behind `authenticate` + `requireRole('venue_owner','admin')` (`app.js:81`), static serve at `/uploads` (`app.js:82`).
- Frontends treat `photos[]` as opaque URL strings: `PhotoUploader` POSTs base64 to `@spots/api` `uploads.upload`; user gallery + admin forms render `photos.map(<img src>)` — no `next/image`, no CSP on hosted pages. **No frontend change required.**
- `venueController.updateVenue` (`sp_be/controller/venueController.js:237`) is the **single write seam** for both owner and admin console edits → orphan-deletion hooks there once.
- Boot is fail-closed via `sp_be/config/env.js` `REQUIRED`.
- DB inventory: exactly 3 photos total, all dead URLs (seed venues). Nothing to backfill.
- Local `sp_be/uploads/` holds only test fixtures (not real venue photos) — unrecoverable.

## Decisions (grill tree — all confirmed)

| # | Decision | Choice |
|---|---|---|
| Q1 | Bucket access | **Public** `venue_images`; plain `img src` on storefront, no signing per-render. |
| Q2 | Write path | **Backend proxy** — `POST /api/v1/uploads` stays; backend calls Supabase Storage with the **service-role key** and returns the absolute public URL. Auth + magic-byte checks stay server-side. |
| Q3 | 3 dead photos | **Clear** `photos[]` on the seed venues via data migration — broken-image UX is gone; owners re-upload through the admin form (lands in Supabase). |
| Q4 | Orphan deletion | **Backend diffs** old vs new `photos[]` in `updateVenue` and deletes removed bucket objects. Zero frontend change. |
| Q5 | Credentials | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (fail-closed at boot, added to `env.js` `REQUIRED`), plus optional `SUPABASE_STORAGE_BUCKET` (default `venue_images`). |
| Q6 | Bucket name | **Adopt `venue_images`**; ADR-0010 updated (was `venue-photos`); bucket name env-configurable. |
| Q7 | Legacy `/uploads` | **Tear down** — remove `express.static` serve + `/uploads/:path*` rewrites in both Next apps + Railway volume mount; declare volume obsolete in deploy docs; drop reference from ticket 04. |
| Q8 | Public-read guarantee | **Backend self-heals** — on boot, `ensureBucket()` with the service-role key creates the bucket if missing and sets public-read. No dashboard toggle. |
| Q9 | Photo model | **Stay `photos: string[]`** of opaque URLs; ordering by array position; orphan-deletion by URL diff. |
| Q10 | Deliverable shape | **One ticket** — contained change, single controller seam. |

## Target Topology

```
Supabase project jxhhlwgwcarhhujhwctv
  ├─ Postgres (existing) ← DATABASE_URL
  └─ Storage bucket venue_images (public, self-healed) ← service-role key
        uploads: POST /api/v1/uploads (backend proxy) → absolute public URL → venues.photos[]
        reads:   plain <img src> (no rewrite, no volume)
```

Browser traffic unchanged except photos: `img src="https://<project>.supabase.co/storage/v1/object/public/venue_images/<uuid>.<ext>"` — rendered directly from Supabase CDN, no backend hop.

## Env Vars To Add

| Var | Where | Value |
|---|---|---|
| `SUPABASE_URL` | Railway + local `.env` | `https://jxhhlwgwcarhhujhwctv.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Railway + local `.env` | service-role key (secret; never commit) |
| `SUPABASE_STORAGE_BUCKET` | optional (default `venue_images`) | `venue_images` |

Fail-closed: `config/env.js` `REQUIRED` gains `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (test env exempt, matching existing pattern).

## Backend Code Delta (exact)

### New `sp_be/utils/storage.js`

- `ensureBucket()` — `GET/PUT /storage/v1/bucket/{id}` via service-role key; create if missing; `public: true`. Called at boot (`index.js`) — fail-closed if the bucket can't be provisioned.
- `uploadObject(objectName, buffer, contentType)` — `POST /storage/v1/object/{bucket}/{name}` with service-role key; returns absolute public URL `https://<project>.supabase.co/storage/v1/object/public/<bucket>/<name>`.
- `deleteObject(objectName)` — `DELETE /storage/v1/object/{bucket}/{name}`; 404 tolerated.
- Object names: `<uuid>.<ext>` (same scheme as today — `crypto.randomUUID()`), keeping `photos[]` values unique and diff-safe.

### `sp_be/routes/uploads.js`

- Keep request shape (`{filename, data}`), auth, rate limit, magic-byte + 8MB checks, 400/413 responses.
- Replace `fs.writeFileSync` with `uploadObject(...)`; return `{ url: <absolute public URL> }`.
- `express.static('/uploads')` removed from `app.js`; `/uploads/:path*` rewrites removed from both `next.config.mjs`.

### `sp_be/controller/venueController.js` — `updateVenue`

- After the update query: `oldPhotos - newPhotos` → for each removed URL that starts with the bucket base, `deleteObject` (fire-and-forget with `.catch(logger)` — a bucket failure must not fail the venue save).

### `sp_be/config/env.js`

- Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` to `REQUIRED`.

### Migration `sp_be/migrations/0014_storage_venue_photos.sql`

- Data migration: clear dead `/uploads/*` URLs from all venues' `photos[]`:
  ```sql
  update venues set photos = '[]'::jsonb, updated_at = now()
  where photos @> '["/uploads/"]'::jsonb and photos ? '/uploads/';
  ```
  (Simpler and safer: `update venues set photos = '[]'::jsonb, updated_at = now() where photos <> '[]'::jsonb;` — the only photos in the DB are the 3 dead seed URLs.)

### `.env.example`

- Document the three new vars.

## Tests

- **`sp_be/test/storage.test.js`** (new): `ensureBucket` idempotent; `uploadObject` returns absolute URL; `deleteObject` 404-tolerant. Mock `fetch` (existing pattern — `vi.stubGlobal`).
- **`sp_be/test/upload.test.js`** (update): response URL is now absolute Supabase public URL; remove `fs` assertions; keep magic-byte/oversize/401 cases unchanged.
- **`sp_be/test/venueController.test.js`** (new or extended): `updateVenue` deletes removed bucket objects (assert `fetch` called with DELETE for the removed URL only); never deletes non-bucket URLs (safety).
- Existing `packages/api` `uploads.upload` test stays green (shape unchanged).

## Runbook

1. Get `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (Q5 — user provides). Add to local `.env` and Railway env.
2. Land code + migration; run `npm run db:setup` (applies 0014) against Supabase Postgres.
3. Deploy Railway; verify boot log shows bucket ensure; `GET /health` 200.
4. Smoke (as seed owner): upload via admin form → image 200 on both app origins + direct Supabase URL.
5. Verify the 3 seed venues now show `photos: []` and the storefront shows no broken images.
6. Redeploy Railway once → **previously uploaded image still 200** (proves persistence, the original failure mode).
7. Remove the Railway volume mount + drop volume references from deploy docs (ticket 04 checklist + spec Q5/Q8 row).

## Verification Checklist

- [ ] `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` fail-closed at boot; boot log confirms `ensureBucket` (public `venue_images`).
- [ ] `POST /api/v1/uploads` (auth'd) → 201 with absolute `https://<project>.supabase.co/storage/v1/object/public/venue_images/<uuid>.<ext>`; direct GET 200.
- [ ] User + admin apps render the image via `<img>` (no CSP issue; no rewrite needed).
- [ ] Migration 0014 applied: seed venues' `photos` = `[]`; storefront no longer shows broken images.
- [ ] Owner edits venue photos → removed URLs deleted from bucket (observed via dashboard or storage list).
- [ ] **Railway redeploy → uploaded image still 200** (persistence — the exact bug this fixes).
- [ ] Legacy `/uploads` 404s cleanly (static serve + rewrites removed); volume mount removed; deploy docs updated.
- [ ] `sp_be` + `packages/api` tests green; `next build` + `tsc --noEmit` green for both apps.

## Rollback

- Revert commit; re-add the `/uploads` static serve + rewrites; photos re-uploaded to Supabase remain readable (absolute URLs still in DB) — but no longer written. Old volume contents are gone regardless (unrecoverable), so rollback only affects *new* uploads.
- `venue_images` bucket contents survive a rollback (they're just unreferenced).

## Follow-ups

- ADR-0010: update bucket name to `venue_images` and mark fulfilled.
- Deploy docs (spec.md Q5/Q8, ticket 04): declare the Railway volume obsolete.
- Ticket 07's "photo upload persistence" checklist item now exercises Supabase instead of the volume.