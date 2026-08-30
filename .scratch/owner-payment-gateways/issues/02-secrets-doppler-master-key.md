# 02 — Secrets: Doppler + master key + credential cache

**Status:** wontfix

> **Superseded 2026-08-30** — Doppler is replaced by Google Secret Manager (ADR-0046). The master-key + credential-cache parts are already shipped via the main effort (ADR-0044, commit `a007043`). The remaining secrets work now lives in `.scratch/secret-manager/` (tickets 01–04). Do not implement as written.

**What to build:** the secrets layer that ADR-0044's credential storage depends on — no secrets in the repo, all backend env in Doppler, per-owner PayHere secrets encrypted at rest, and IPN verification never blocking on the secrets manager.

- **Doppler setup**: project with production/staging/preview environments; move all backend env (DATABASE_URL, PAYHERE_*, MAILGUN_*, SMSGO_*, OTP_HMAC_SECRET, JWT_SECRET, SUPABASE_*, Firebase cred) out of `.env`/Railway config; wire Doppler into Railway (nixpacks) via the Doppler integration or run script. Document onboarding in `sp_be/README.md`.
- **Encryption service**: generalize `sp_be/services/siteTotp.js` AES-256-GCM helper into a shared `encryptSecret`/`decryptSecret` (nonce handling, key from new `MASTER_ENCRYPTION_KEY` env — itself in Doppler, with a distinct key from OTP).
- **Credential store**: read/write encrypted business PayHere secrets through the encryption service; never log or return plaintext (API responses return `configured: bool` + masked hints only).
- **Cache**: in-memory credential cache (business_id → decrypted creds), TTL ~5 min, invalidated by an `invalidateCredentials(businessId)` call on owner save/remove; webhook/checkout paths read through the cache, falling back to DB decrypt on miss, never to the secrets manager at request time.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Doppler project live; Railway deploys with no plaintext env in repo (grep sweep for secrets)
- [ ] Encryption service shared; TOTP tests still green
- [ ] Cache read-through with TTL + invalidation hook; unit tests for miss/expiry/invalidation
- [ ] README documents Doppler onboarding for new devs