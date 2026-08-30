# 13 — Events boundary + docs sweep

**What to build:** confirm and record the Events boundary, and sweep docs/tests for the retired vocabulary.

- **Events**: Event Registrations stay on the **platform gateway** (env keys, admin flag) — untouched by per-business config (Q6/Q35). Per-business gateways for events recorded as a future step in ADR-0044.
- **Docs sweep**: replace remaining `'online'` payment references across `.scratch/`, ADRs, tests, and UI copy where they mean the PayHere method — `'payhere'` is the value, "PayHere" the label (report labels, digests, badges, README). `'online'` remains only where it means the general "paid over the internet" sense (e.g. marketplace retirement copy).
- **Tests**: existing suites asserting `payment_method='online'` (e.g. `packages/api/src/index.test.ts`, `cancellation.js`, `dailyDigest.js`) updated to `'payhere'`.
- Verify `sp_be/utils/payhere.js` sandbox URL + `PAYHERE_CHECKOUT_URL` consistent with 05's resolution.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Events: no behavioral change; ADR-0044 notes future step
- [ ] `'online'` → `'payhere'` swept in code, tests, scratch specs, ADRs, UI labels
- [ ] Report/digest/bill labels read "PayHere"; no regressions in suite