# 01 — Backend: brand config, migration, email/SMS/digest copy

**What to build:** the backend carries the new brand everywhere it is baked, and the config mechanism becomes writable.

- Migration `sp_be/migrations/0015_brand_myslot_lk.sql`: upsert `platform_config.brand_name = "MySlot.LK"`; update demo users to `admin@myslot.lk`, `owner@myslot.lk`, `player@myslot.lk` (ON CONFLICT-safe, idempotent).
- Edit `sp_be/migrations/0002_seed.sql`: seed `brand_name = "MySlot.LK"` and the new demo emails so fresh installs start correct.
- `sp_be/utils/featureFlags.js`: fallback for `getBrandName()` → `'MySlot.LK'`; extend `setConfig` to accept `brand_name` (trimmed non-empty string, length-capped, audit-trailed alongside flags and tax_rate).
- `sp_be/routes/publicConfig.js` / `sp_be/controller/adminConfigController.js`: no shape change needed for reads; the admin write path already routes through `setConfig` — verify the brand field round-trips through both.
- `sp_be/utils/smsService.js`: prefixes `Spots: ` → `MySlot.LK: ` in booking confirmation and cancellation templates.
- `sp_be/controller/verifyPhoneController.js`: verification-code SMS prefix → `MySlot.LK: `.
- `sp_be/utils/emailService.js`: `DEFAULT_FROM` → `MySlot.LK <no-reply@myslot.lk>`; shell footer "Spots — book courts, join games, find players." → "MySlot.LK — …"; welcome email "Welcome to Spots!" → "Welcome to MySlot.LK!"; booking email "…in the Spots app…" → "…in the MySlot.LK app…".
- `sp_be/jobs/dailyDigest.js`: digest subject `Spots daily digest` → `MySlot.LK daily digest`.

**Blocked by:** —

**Status:** ready-for-human (implemented, code-level checks pass; deploy-level checks pending)

- [ ] Migration 0015 applied to an existing seeded DB leaves `brand_name = 'MySlot.LK'` and demo emails on `@myslot.lk`
- [ ] `0002_seed.sql` produces the new brand/emails on a fresh install
- [ ] `setConfig('brand_name', …)` succeeds, rejects blank/overlong, writes a `flag_audits` row
- [ ] Public config and admin config endpoints return `brand_name: "MySlot.LK"` by default
- [ ] SMS templates, email FROM/footer/welcome, and digest subject carry the new brand
- [ ] `sp_be` tests updated/passing (fixtures asserting the old brand)