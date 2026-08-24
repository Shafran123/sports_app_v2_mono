# 02 — outbound_messages audit table

**What to build:** the audit trail behind every send attempt — the thing that makes SMSGo's pre-approval period a visible dry-run instead of silent log-and-skip, and the debug record once live.

**Depends on:** 01 (dispatch calls the writer)

**Status:** ready-for-agent

- [ ] Migration: `outbound_messages` table — `id`, `channel` (`email`|`sms`), `message_key`, `to`, `status` (`sent`|`skipped`|`failed`), `provider_ref`, `error`, `sent_at` (default now())
- [ ] `recordOutbound({ channel, to, key, status, error, providerRef })` helper in the catalog; call from email + SMS channels on every attempt (success AND failure)
- [ ] SMS channel records `skipped` when `sms_enabled` is off or `SMSGO_API_KEY` unset — this is the pre-approval dry-run record
- [ ] OTP sends (`verifyPhoneController.js`) write an audit row too, even though the send stays synchronous/direct
- [ ] Tests: email/sms success → `sent` row; sms flag off → `skipped` row; transport throw → `failed` row; controller still returns 502 on OTP send failure
- [ ] `npm test` green