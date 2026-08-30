# 01 — Backend boot: pull platform secrets from Google Secret Manager

**What to build:** the runtime mechanism that makes GCP Secret Manager (ADR-0046) the source of every **Platform Secret** at backend boot — without changing how the rest of the code reads them. On boot, resolve the platform secrets from GSM into `process.env` **before** `config/env.js` validation runs, with retry and fail-fast, so the HTTP server never starts against a missing or stale secret and webhook/refund paths never touch the manager at call time.

- A secrets bootstrap module with a mapping (env var name → GSM secret resource in project `myslot-preprod`) covering the platform set: platform PayHere keys, `MASTER_ENCRYPTION_KEY`, Mailgun, SMSGo, OTP HMAC, Supabase service-role key, Firebase service account. New env vars beyond the existing set should stay minimal.
- **A dedicated GSM credential source** — e.g. `SECRET_MANAGER_CREDENTIALS` (base64 service-account JSON). It must NOT reuse `GOOGLE_APPLICATION_CREDENTIALS`, which `config/firebase.js` already consumes for the Firebase admin SDK — sharing it would hand firebase-admin a non-Firebase SA and break boot/auth.
- Fetch once at startup with retry/backoff, fail-fast on persistent outage (matches the existing "no boot without secrets" philosophy). Existing code keeps reading `process.env` unchanged.
- A local/test mode: tests keep using their own in-process secrets and never call GSM (the existing test bypass in `config/env.js` validation stays).
- Wire the bootstrap into the boot sequence ahead of config validation, with a clear boot log line when a secret is injected from GSM vs supplied directly (env still wins when both are present — lets a dev override a single secret locally).

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] With `SECRET_MANAGER_CREDENTIALS` + GSM secrets in `myslot-preprod`, the backend boots with every platform secret in `process.env` and no direct env value for them
- [ ] Without GSM access, boot fails fast with a clear error (after retries) — never a half-configured server
- [ ] Webhook (IPN) verification and refund paths make zero GSM calls at request time
- [ ] Direct env values still override GSM per-secret in local dev; tests pass without GSM
- [ ] No change to how the rest of the code reads secrets (`process.env` only)

## Comments

Spawned from grilling session 2026-08-30 (ADR-0046). Do not implement per-tenant (Business PayHere Credentials) lookups through this path — those stay in Postgres.

## Comments

Implemented 2026-08-30 in commit `6a4fef8`. Agent-able work complete; ticket 03 (human-run GCP/Railway cutover) remains open.

## Status (2026-08-30, superseded by ADR-0047)

SUPERSEDED: the platform-secret move was reversed by the product owner — platform secrets stay in the deployment env, unchanged. GSM is repurposed to hold the per-Business PayHere credentials instead (one secret per Business). The boot-fetch mechanism, MASTER_ENCRYPTION_KEY requirement, and the 11 GSM platform shells built by this ticket set were reverted/deleted; `config/platformSecrets.js`, `test/platformSecrets.test.js`, `utils/encryption.js`, `test/encryption.test.js` are gone, `env.js` REQUIRED is restored, and `SECRET_MANAGER_CREDENTIALS` now only enables the per-Business credential store (ADR-0047, `services/secretManager.js`).
