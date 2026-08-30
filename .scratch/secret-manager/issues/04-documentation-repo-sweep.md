# 04 — Documentation + repo sweep for the GSM cutover

**What to build:** make the repo's documentation match the new secrets reality and prove no plaintext secrets sit in the tree. Update env documentation and onboarding so a fresh developer knows where every Platform Secret comes from, supersede the old secrets ticket, and sweep the repo for committed secrets.

- `.env.example` and the backend README: document `SECRET_MANAGER_CREDENTIALS` (base64 GSM SA JSON, optional in dev), `MASTER_ENCRYPTION_KEY` (now required in non-test), and that the remaining platform secrets are resolved from GSM at boot in production (Railway env holds only non-secret config + the SA key). Keep the dev story: local `.env` direct values still work and override GSM per secret.
- Grep sweep across the repo (excluding lockfiles and the pre-existing Firebase SA JSON that `.gitignore` whitelists): no platform secret values committed; flag any stragglers for removal from history or rotation.
- Supersede the earlier secrets ticket: mark `.scratch/owner-payment-gateways/issues/02-secrets-doppler-master-key.md` as `wontfix` (superseded by ADR-0046 + this effort) with a pointer, so nobody implements Doppler.
- Confirm `CONTEXT.md` entries (Business PayHere Credentials, Platform Secret) and ADR-0046/0044 wording are current after the cutover.

**Blocked by:** 01, 02 — documentation must describe the real mechanism and the required key

**Status:** ready-for-agent

- [ ] `.env.example` + backend README document the GSM bootstrap, `SECRET_MANAGER_CREDENTIALS`, and required `MASTER_ENCRYPTION_KEY`
- [ ] Sweep report: no plaintext platform secrets in the repo (excluding the whitelisted Firebase SA)
- [ ] Old secrets ticket 02 marked superseded with a pointer to ADR-0046
- [ ] CONTEXT/ADR wording consistent with the shipped mechanism

## Comments

Spawned from grilling session 2026-08-30 (ADR-0046).
