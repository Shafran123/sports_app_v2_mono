# 01 — Fail-closed secrets at boot

**What to build:** the API refuses to start when a required secret is missing (non-test env), and all public-string fallback defaults are removed from production code.

**Blocked by:** none

**Status:** ready-for-agent

## Scope

- New `sp_be/config/env.js` (or equivalent) that validates env vars and centralizes access to them:
  - Required in non-test: `DATABASE_URL`, `FRONTEND_URL`, `PAYHERE_MERCHANT_ID`, `PAYHERE_MERCHANT_SECRET`, `GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_SERVICE_ACCOUNT`, `MAILGUN_API_KEY`, `SMSGO_API_KEY`.
  - Missing any → log the missing key names and `process.exit(1)` with an actionable message. Never start half-configured.
- Remove fallbacks:
  - `paymentController.js:9,14` `|| 'TEST_MERCHANT_ID'` / `|| 'test-merchant-secret'`.
  - `utils/payhere.js:3-5` same defaults.
  - `middleware/authenticate.js:9` test-path secret stays, but the branch is only reachable under `NODE_ENV=test` (verify and document; prod must take `verifyIdToken`).
- Keep the documented `.env.example` in sync with the required keys (add `PAYHERE_*` — they were missing from the local `.env`).

## Verification

- Unit/integration: boot (or `config/env.js` invocation) fails with the list of missing keys when any are unset.
- Test with `NODE_ENV=test` still boots (test fallbacks allowed under test).
- Grep proves no `|| 'test-merchant` or `|| 'TEST_MERCHANT` remains in non-test code paths.

## Done criteria

- [ ] Non-test boot fails loudly and lists every missing required key.
- [ ] No public-string fallback secrets in production code paths.
- [ ] `.env.example` documents every required key.
- [ ] Full test suite passes under `NODE_ENV=test`.