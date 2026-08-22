# 10 — Uploads: body limit fix + magic-byte validation

**What to build:** fix the broken upload path (every image >~75KB 500s) and stop accepting non-image bytes.

**Blocked by:** none

**Status:** ready-for-agent

## Scope

- Bug: `app.js:27` `express.json()` default limit is 100KB; uploads arrive as base64 bodies (8MB claim in `routes/uploads.js`), so realistic images fail with a 500 via the generic error handler (`app.js:59-70`).
  - Raise the body limit for the upload path (e.g. `express.json({ limit: '10mb' })` on the uploads router, or app-level 10mb — 8MB intent fits in ~10.7MB base64; keep margin).
  - Keep the existing 8MB file-size check in `routes/uploads.js`.
- Magic bytes before `fs.writeFileSync` (`routes/uploads.js:11-34`):
  - PNG: `89 50 4E 47 0D 0A 1A 0A`; JPEG: `FF D8 FF`; WebP: `52 49 46 46 ... 57 45 42 50` — compare buffer start; reject non-matching with `400 { code: 'INVALID_IMAGE' }`.
  - Keep extension allow-list + UUID filenames (no traversal risk).
- Error mapping: oversized body → clean `413` (respect `limit` syntax) rather than 500; widen the error handler to surface `PayloadTooLargeError`.

## Verification

- Super/integration test: valid PNG (real bytes) uploads OK; a text file renamed `.png` → `400 INVALID_IMAGE`; base64 body under 8MB passes; >8MB → 413/400 guarded.
- Manual: existing UI upload works end-to-end again (the regression this fixes).

## Done criteria

- [ ] Real images >100KB upload successfully (limit raised).
- [ ] Non-image bytes rejected by magic check.
- [ ] Oversize → clean 4xx, not a 500.
- [ ] Suite green.