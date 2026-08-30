# 0047 — Per-Business PayHere credentials live in Google Secret Manager

**Status:** accepted

## Context

ADR-0044 planned the owner-supplied PayHere credentials (merchant secret, app secret) encrypted at rest in Postgres under a master key, and ADR-0046 extended that into moving the *platform* secrets to Google Secret Manager at boot. Two facts broke that plan:

1. **Platform secrets must not move.** The deployment env (`Railway` env vars / local `.env`) is the single source for every platform/operator secret — unchanged from before this feature. There is no platform secrets manager.
2. **Owner credentials must not live in the DB.** The product requirement: per-Business PayHere credentials go to Google Secret Manager, keyed by tenant identity, so they are never copied into the backend repo, `sp_be`, or the owner/player apps, and rotation is a GSM version bump that never requires a redeploy.

## Decision

- **One GSM secret per Business**: `business-payhere-<businessId>`, payload a JSON blob of the four fields (`merchant_id`, `merchant_secret`, `app_id`, `app_secret`). Always read as the `latest` version; saving credentials adds a new version (rotation without redeploy); "remove keys" deletes the secret outright.
- **Tenant identity is the secret name.** A single platform service account (`sm-secret-reader@myslot-preprod.iam.gserviceaccount.com`) is the parent for all tenants — no per-tenant SA, no per-secret IAM. Roles at project level: `roles/secretmanager.admin` (create/rotate/delete/read; the narrower `secretCreator`/`secretVersionAdder` are secret-level-only and can't be granted project-wide, and without create the first save for a new Business would fail).
- **The DB keeps nothing secret.** `business_payment_methods` retains `merchant_id`/`app_id` (not secret; drive `payhere_configured` + owner/admin UI hints) and drops `merchant_secret_enc`/`app_secret_enc` (migration 0036).
- **Resolution:** `resolvePayhereCredentials(businessId)` reads GSM through a 5-minute in-memory cache, invalidated on owner save/remove. A transient GSM failure fails the request closed without caching; a definitive "no secret for this Business" (404) is cached. **Never** a fallback to the platform gateway in production.
- **Dev/test fallback:** without `SECRET_MANAGER_CREDENTIALS` (local dev, tests, CI) the platform env keys stand in for the business credentials — exactly the values the test suite signs checkout params and webhooks with. The owner save/remove endpoints refuse to run in this mode (`PAYHERE_SECRET_MANAGER_REQUIRED`).
- **Authentication:** `SECRET_MANAGER_CREDENTIALS` (base64 or raw service-account JSON) in the deployment env. Deliberately its **own** var — `GOOGLE_APPLICATION_CREDENTIALS` is consumed by firebase-admin (`config/firebase.js`). Project id from `SECRET_MANAGER_PROJECT` (default `myslot-preprod`). Dependency-free JWT (RFC 7523) + Secret Manager REST via `node:crypto` + global `fetch`.

## Considered Options

- **Encrypted ciphertext in Postgres (ADR-0044 original)**: keeps credentials out of any external store, but they ride along in every DB backup, dump, and test copy; a DB compromise leaks all tenants' credentials; rotation needs a bulk re-encrypt job. Rejected by product: no secret material in the DB.
- **Platform secrets manager for everything (ADR-0046)**: moves operator secrets to GSM at boot. Rejected by product: `.env`/deployment env stays the source of truth, unchanged.
- **Per-tenant service account or per-secret IAM**: strongest isolation but heavyweight — one SA/key per Business doesn't scale to onboarding, and per-secret IAM grants are a new failure mode for tenant setup. Rejected; naming is the tenant boundary.
- **Env fallback in production**: if a Business has no GSM secret, serve the platform gateway's credentials. Rejected — fail-closed: a payment must never be minted or verified on the wrong gateway.

## Consequences

- `sp_be/services/secretManager.js`: GSM client (get/put/delete per Business, token cache, retry with backoff).
- `sp_be/services/businessPaymentMethods.js`: save → validate app pair → `putCredentials` (GSM) → upsert IDs row; remove → delete GSM secret + clear row; resolve → GSM (cached) or env fallback when unconfigured.
- `sp_be/migrations/0036_payhere_creds_to_secret_manager.sql`: drops the two `_enc` columns.
- `utils/encryption.js` deleted (its only consumer was the business credentials); `maskLast4` moved to `utils/format.js`; `MASTER_ENCRYPTION_KEY` removed from REQUIRED and everywhere else. `siteTotp.js` keeps its own encryption unchanged.
- Platform half of ADR-0046 reverted: `config/platformSecrets.js` + its test deleted, `index.js` back to env-validated boot, the 11 platform GSM secret shells deleted. Platform secrets stay in env.
- One-off backfill (dev, 2026-08-30): the single stored row decrypted with the old master key and uploaded as `business-payhere-2c640e5f-…` before migration 0036 ran.
- Owner console UX unchanged: four fields, validate-on-save, connected badge, remove keys.
- CONTEXT.md: **Business PayHere Credentials** re-termed as tenant-scoped, GSM-held; **Platform Secret** re-termed as deployment-env-held.
