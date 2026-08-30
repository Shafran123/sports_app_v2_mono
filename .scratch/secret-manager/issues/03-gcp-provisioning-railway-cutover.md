# 03 — GCP provisioning + Railway cutover (operator-run)

**What to build:** the human-run cutover that makes GSM the live source of every Platform Secret in production. Create the secrets and a least-privilege service account in GCP project `myslot-preprod`, load all platform secret values into GSM, wire the service account into Railway, migrate values out of Railway's env config, and verify the whole path end-to-end — including that owner credential save/refund still works and webhook verification never touches GSM at call time.

- In GCP `myslot-preprod`: create one secret per platform secret (platform PayHere keys, `MASTER_ENCRYPTION_KEY`, Mailgun, SMSGo, OTP HMAC, Supabase service-role key, Firebase service account), and a dedicated service account holding only `roles/secretmanager.secretAccessor` on those secrets. Export its JSON key for Railway (rotate it, never commit it).
- Railway: inject the GSM SA key as `SECRET_MANAGER_CREDENTIALS` (a dedicated var — NOT `GOOGLE_APPLICATION_CREDENTIALS`, which the Firebase admin SDK consumes). Keep the existing Firebase SA credential var as-is.
- Migrate the platform secret values out of Railway's env into GSM; leave non-secret config (URLs, flags, ports) in env.
- Verify: clean boot on a fresh Railway deploy (migrations + storage check still pass), an owner's PayHere credential save round-trips (encrypt → store → decrypt for checkout/IPN/refund), a webhook/IPN signature verification succeeds with zero GSM calls at request time, and refunds (owner-scope and platform-scope) still work.
- Record the rotation runbook (including a `MASTER_ENCRYPTION_KEY` rotation = bulk re-encrypt of stored Business PayHere Credentials, deferred until real credentials exist) as a note in ADR-0046.

**Blocked by:** 01 (boot fetch mechanism must exist to consume the secrets), 02 (master key must be required/enforced)

**Status:** ready-for-human

- [ ] Secrets + least-privilege SA live in `myslot-preprod`; SA key injected into Railway as `SECRET_MANAGER_CREDENTIALS`
- [ ] All platform secrets migrated out of Railway env into GSM; Railway env holds only non-secret config + the SA key
- [ ] Fresh Railway deploy boots clean with secrets resolved from GSM
- [ ] Owner PayHere credential save/checkout/IPN/refund round-trip verified in production
- [ ] No plaintext platform secret remains in Railway env, `.env`, or the repo (see ticket 04 sweep)
- [ ] Rotation runbook noted in ADR-0046

## Comments

Spawned from grilling session 2026-08-30 (ADR-0046). Human-in-the-loop: needs access to GCP `myslot-preprod` and the Railway project.

## Status (2026-08-30, superseded by ADR-0047)

SUPERSEDED: the platform-secret cutover never happened — the 11 GSM platform shells were DELETED (no versions were ever uploaded). The remaining cutover work is now: owner save flow writes per-Business secrets (already working end-to-end in dev — business `2c640e5f-ee54-4edc-a26d-36df2917a036` was backfilled to `business-payhere-2c640e5f-ee54-4edc-a26d-36df2917a036`), then add `SECRET_MANAGER_CREDENTIALS` (base64 of `~/.config/myslot/sm-secret-reader.json`) to Railway env and re-verify an owner save + checkout + IPN on the deployed backend. SA `sm-secret-reader` now holds `roles/secretmanager.admin` on the project.
