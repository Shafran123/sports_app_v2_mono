# 0046 — Google Secret Manager replaces Doppler as the backend secrets manager

**Status:** superseded by [ADR-0047](./0047-business-payhere-credentials-in-secret-manager.md)

This ADR was accepted and implemented, then reversed. It moved the **platform** operator secrets into Google Secret Manager at boot. The product owner rejected that: platform secrets must stay in the deployment env, unchanged. The GSM investment was kept but redirected: per-Business PayHere credentials move into GSM as per-Business secrets (ADR-0047), the opposite of this ADR's "tenant data stays in Postgres" ruling. Everything below is retained as the record of what was built and then reverted.

## Context

ADR-0044 planned **Doppler** as the single secrets manager for backend env. Before wiring it up we re-evaluated: Doppler's model (project / env / secret) has no per-tenant key concept, its pricing scales with seats, and the per-Business PayHere credentials are tenant data, not operator secrets — one set per Business, many businesses. GCP Secret Manager is available (project `myslot-preprod`) and bills ~$0.06 per active secret version per month, so ~10 platform secrets cost under $1/mo flat, independent of tenant count.

## Decision

- **Per-Business PayHere credentials stay in Postgres** as encrypted tenant rows (ADR-0044); they are *not* moved to any secrets manager. GSM has no row-level security — a shared service account that can write tenant secrets can read them all; storing creds and flipping a method's enabled flag is one transaction today but would split across DB + GSM; IPN verification (`resolvePayhereCredentials`) must not depend on an external fetch or a manager outage; and per-tenant secrets version on every owner save, making cost and lifecycle grow with every new Business. Tenant scale is exactly why these are data, not secrets.
- **All platform/operator secrets move to GCP Secret Manager** (`myslot-preprod`): platform PayHere keys, `MASTER_ENCRYPTION_KEY`, Mailgun, SMSGo, OTP HMAC, Supabase service-role key, Firebase service account. Fetched **once at boot** into `process.env` before config validation, with retry and fail-fast — existing code keeps reading `process.env` unchanged, and webhook/refund paths never touch the manager at call time. Frontends are untouched: they hold no secrets (`NEXT_PUBLIC_*` are public; the admin console POSTs credentials, it never sees them).
- **`MASTER_ENCRYPTION_KEY` becomes required**, and the dev fallback chain in `sp_be/utils/encryption.js` (TOTP → OTP → JWT → hardcoded dev key) is removed except a test-only dev key. No owner credentials exist anywhere yet, so the key is introduced before any real data is encrypted. Rotation (a bulk re-encrypt once credentials exist) is documented as a runbook item, not built now.
- **Railway authenticates to GSM** via a dedicated service account with only `roles/secretmanager.secretAccessor`, its JSON key injected as `SECRET_MANAGER_CREDENTIALS` — deliberately **not** `GOOGLE_APPLICATION_CREDENTIALS`, which the firebase-admin SDK consumes (`config/firebase.js`). The Firebase service account stays a separate credential — least privilege, independent rotation.

## Considered Options

- **Doppler**: no per-tenant key model; cost scales with seats. Rejected.
- **Per-tenant secrets in GSM** (one JSON or four secrets per Business, app-managed): isolation (single all-tenant service account), atomicity (DB+GSM split), webhook reliability, and lifecycle/cost all argue against. Rejected; tenant data belongs in the tenant DB.
- **Secrets in Railway env directly**: no versioning, rotation, or audit; secrets copied onto every deploy. Rejected.

## Consequences

- Boot: GSM fetch (with retry) before `config/env` validation; fail fast on outage.
- `sp_be/config/env.js`: `MASTER_ENCRYPTION_KEY` added to REQUIRED.
- `sp_be/utils/encryption.js`: fallback chain removed (test dev key remains).
- Railway: SA key injected as `SECRET_MANAGER_CREDENTIALS` (own var — `GOOGLE_APPLICATION_CREDENTIALS` stays the Firebase credential).
- ADR-0044's Doppler passages amended to reference GSM (ADR-0046); `.scratch/owner-payment-gateways/issues/02-secrets-doppler-master-key.md` superseded by this ADR.
- Operator runbook (next session): create SA + secrets in `myslot-preprod`, inject SA key into Railway, migrate values, verify boot, strip plaintext from Railway env.
