# Supabase Storage for venue photos — migrate off the Railway volume

Type: task
Status: ready-for-agent
Feature: supabase-storage

## Context

The three seed venues' photos vanished from the Railway instance (`404` on all `/uploads/*` URLs; files gone and unrecoverable — local `uploads/` only holds test fixtures). Root cause chain: uploads write to `/app/uploads` on the instance's **ephemeral disk** while the volume is mounted at `/app/sp_be/uploads`, so a redeploy wipes them; disk storage is also ephemeral by design. The fix is ADR-0010's end state: venue photos live in Supabase Storage bucket **`venue_images`** (public, exists, empty), written by the backend with the service-role key. Supabase Postgres (project `jxhhlwgwcarhhujhwctv`) is already the DB, so this is contained.

Frontends treat `photos[]` as opaque URL strings — **no frontend change**. Upload route keeps its request/response shape; only the backing store changes.

## Deliverables

1. **`sp_be/utils/storage.js`** (new): `ensureBucket()` (create-if-missing, `public: true`, called at boot, fail-closed), `uploadObject()` → absolute public URL, `deleteObject()` (404-tolerant). Use Node built-in `fetch` + service-role key.
2. **`sp_be/routes/uploads.js`**: swap `fs.writeFileSync` → `uploadObject`; return `{ url: <absolute public Supabase URL> }`. Keep auth, role, rate limit, magic-byte + 8MB checks, 400/413 responses, request shape.
3. **`sp_be/app.js`**: remove `express.static('/uploads')` (line 82).
4. **`apps/user/next.config.mjs` + `apps/admin/next.config.mjs`**: remove the `/uploads/:path*` rewrite (added in `630e5aa`).
5. **`sp_be/controller/venueController.js` `updateVenue`**: after save, diff old vs new `photos[]`; `deleteObject` each removed URL that starts with the bucket base (fire-and-forget with `.catch(logger)` — bucket failure must not fail the venue save). Never delete non-bucket URLs.
6. **`sp_be/config/env.js`**: add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` to `REQUIRED` (test env exempt, matching the existing pattern).
7. **`sp_be/.env.example`**: document the three vars (incl. optional `SUPABASE_STORAGE_BUCKET`, default `venue_images`).
8. **Migration `sp_be/migrations/0014_storage_venue_photos.sql`**: clear the dead photos — the only non-empty `photos[]` in the DB are the 3 seed URLs:
   ```sql
   update venues set photos = '[]'::jsonb, updated_at = now()
   where photos <> '[]'::jsonb;
   ```
9. **Tests**: new `sp_be/test/storage.test.js` (ensureBucket idempotent, upload → absolute URL, delete 404-tolerant; mock `fetch`); update `sp_be/test/upload.test.js` (URL shape, drop `fs` assertions, keep magic-byte/oversize/401); new `sp_be/test/venuePhotoCleanup.test.js` (removed photos trigger DELETE for bucket URLs only). Repo convention: mock `fetch` via `vi.stubGlobal` (module `vi.mock` is inert in this vitest setup).
   - Implementation notes from live verification: the Storage API wants the key as **`apikey` header AND `Authorization: Bearer`** (Bearer alone → "Invalid Compact JWS"); a missing object on DELETE comes back as **HTTP 400 with `{"statusCode":"404"}` (string)** — `deleteObject` tolerates that exact shape.
10. **Railway**: set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` on the service; remove the **volume mount**; drop volume references from `.scratch/deployment/issues/04-railway-service.md` + `spec.md` (Q5/Q8 row) and declare obsolete.
11. **ADR-0010**: update bucket name to `venue_images`, mark fulfilled (was `venue-photos`).

## Done

- [ ] `npm run db:setup` applies 0014 against Supabase Postgres; seed venues `photos = []`.
- [ ] Boot fail-closed on the two required vars; boot log confirms `ensureBucket` (public `venue_images`).
- [ ] Auth'd upload → 201 with absolute public Supabase URL; direct GET 200.
- [ ] User + admin apps render uploaded image via `<img>` (both origins).
- [ ] Venue photo removal deletes the bucket object (no orphan accumulation).
- [ ] Railway redeploy → uploaded image still 200 (the original bug's exact test).
- [ ] Legacy `/uploads` 404s; rewrites + static serve + volume removed; deploy docs updated.
- [ ] `sp_be` tests + `packages/api` tests green; both Next apps build (`next build` + `tsc --noEmit`).

Blocked by: nothing (ADR-0010 already accepted; bucket `venue_images` exists)