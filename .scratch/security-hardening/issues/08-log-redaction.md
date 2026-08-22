# 08 — Sensitive-data log redaction

**What to build:** stop writing OTP codes, tokens, phones, and idempotency keys into logs.

**Blocked by:** none

**Status:** ready-for-agent

## Scope

- `middleware/requestLogger.js:10-18` currently logs the full request body, masking only `password`. This writes OTP codes (`POST /auth/verify-phone/confirm`), `fcm_token`, `idempotency_key`, phone numbers into `logs/combined.log` + console.
- Behavior:
  - Recursively walk body/query/params (and headers) and mask any key matching (case-insensitive regex): `code`, `otp`, `token`, `password`, `secret`, `key` (`idempotency_key`, `api_key`), `fcm_token`, `phone` (mask to `+94******` prefix + 4 last), `authorization` header content.
  - Replacement value: `'[REDACTED]'`.
  - Never log SMS body content (SMSGo) — `utils/smsService.js` must not `logger.info` the message (verify): if it does, drop the body from the log line.
  - Denylist approach chosen over whitelist in the grill; keep it.
- Verify no other `logger.` call passes a code/otp/phone: grep `logger` in controllers.

## Verification

- Vitest: a stubbed request with `{phone:'+94771234567', code:'123456', idempotency_key:'k'}` → logged body has `[REDACTED]` for those keys, `code` value absent. Assert the produced line does not contain `123456` or the full phone number.
- Manual: run a real confirm, check `logs/combined.log` (masked).

## Done criteria

- [ ] Denylist masking live; OTP/token/phone/idempotency keys never in logs.
- [ ] SMS body never logged.
- [ ] Regression test asserts absence in log output.