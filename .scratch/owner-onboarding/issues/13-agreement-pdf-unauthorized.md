# 13 — Agreement PDF link returns 401 "No token provided"

**Status:** completed

**What to fix:** the "Download PDF" / "PDF" links on the owner **Plan & agreement** page hit the backend without authentication and fail with `UNAUTHORIZED — Access denied. No token provided.` instead of opening the agreement PDF.

**Reproduction:**

1. Sign in to the owner console (any owner with an agreement, accepted or pending).
2. Open **Plan & agreement** and click "Download PDF".
3. New tab opens a JSON error body instead of a PDF:

```
http://localhost:3001/api/owner-onboarding/agreements/eab486f2-5d5a-4d06-8bf1-b500bb0b7cea/pdf
{"success":false,"error":{"code":"UNAUTHORIZED","message":"Access denied. No token provided."}}
```

**Root cause:** the links are plain anchor tags (`apps/admin/src/features/plan/plan-page.tsx:108` and `:164`) pointing at `/api/owner-onboarding/agreements/:id/pdf`. Next.js rewrites `/api/:path*` to the backend (`apps/admin/next.config.mjs:8`), but a plain browser navigation sends **no `Authorization` header**. The token is only attached by the axios client (`packages/api/src/client.ts:10-17`) for in-app fetch calls. The backend's `authenticate.js` middleware rejects the unauthenticated request before `getAgreementPdf` (`sp_be/controller/ownersController.js:499`) can authorize it.

**Fix directions (pick one):**

- Preferred: fetch the PDF through the authenticated axios client as a blob and open/serve it from the app (no credential in the URL, no auth leakage in `target="_blank"`).
- Alternative: backend issues a short-lived signed token for the PDF URL (owner or admin only), appended as a query param — do not reuse the console bearer token.

**Acceptance criteria:**

- [ ] Both PDF links (pending agreement + agreement history) open the actual PDF in a new tab for an accepted/pending owner
- [ ] An owner cannot fetch another owner's agreement PDF (403) — the ownership check in `getAgreementPdf` still applies
- [ ] An unauthenticated request still gets 401 (no open endpoint introduced)
- [ ] The fix works through the Next.js `/api` rewrite in both local and deployed builds
## Comments

Fixed 2026-08-23. Replaced the raw `<a href="/api/.../pdf">` anchors (which carried no Authorization header) with buttons that fetch the PDF as a blob through the authenticated axios client (`ownerOnboarding.agreementPdf` in `packages/api`, `responseType: "blob"`) and open it in a new tab via a blob URL; popup-blocked case surfaces an inline error. Tests: `packages/api/src/index.test.ts` ("requests the agreement as a blob over the authenticated client") and `plan-page.test.tsx` (no bare PDF link rendered; clicking "Download PDF" calls `agreementPdf` with the agreement id).
