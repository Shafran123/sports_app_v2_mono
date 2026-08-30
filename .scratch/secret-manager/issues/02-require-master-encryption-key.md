# 02 — Require MASTER_ENCRYPTION_KEY; remove the dev fallback chain

**What to build:** close the gap where production could silently encrypt Business PayHere Credentials under a fallback key. Make the master encryption key a hard boot requirement and delete the fallback chain from the encryption service, keeping only a test-only dev key so the test environment keeps working.

- `MASTER_ENCRYPTION_KEY` added to the REQUIRED list in `sp_be/config/env.js` (alongside the other fail-closed secrets; the existing test bypass in validation stays).
- In the encryption service (`sp_be/utils/encryption.js`), replace the fallback chain (`TOTP_ENCRYPTION_KEY → OTP_HMAC_SECRET → JWT_SECRET → hardcoded dev key`) with: `MASTER_ENCRYPTION_KEY` in any non-test environment (missing ⇒ boot fails via REQUIRED), and a fixed dev key only under test so unit tests that call `encryptSecret`/`decryptSecret` keep passing.
- No owner credentials exist in any environment yet, so the key is introduced before any real data is encrypted — no re-encryption needed now. Rotation (a bulk re-encrypt job once real credentials exist) is a documented runbook note in ADR-0046, not built here.
- Verify `sp_be/services/siteTotp.js` (Second Factor) is untouched — it keeps its own key derivation and existing stored TOTP secrets must keep decrypting.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Boot without `MASTER_ENCRYPTION_KEY` fails in non-test environments with a clear message
- [ ] `encryptSecret`/`decryptSecret` round-trip works with the master key; tests still pass with the test dev key
- [ ] Existing Second Factor TOTP secrets still decrypt (siteTotp unchanged)
- [ ] No remaining reference to the old fallback chain in the encryption service
- [ ] Rollout note: `MASTER_ENCRYPTION_KEY` must be present (Railway env or GSM via ticket 01) before this lands in production

## Comments

Spawned from grilling session 2026-08-30 (ADR-0046).
