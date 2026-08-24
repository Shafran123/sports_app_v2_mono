# 07 — Branding, per-event SMS gating, docs

**What to build:** make brand name the single source everywhere, and add the config gate that lets owner-SMS (and any SMS key) be disabled without code — the cost-control you chose in the grill (Q8).

**Depends on:** 01, 03, 04

**Status:** ready-for-agent

- [ ] All email subjects + HTML + SMS copy read `brand_name` via `getBrandName()` — today only the digest and PDFs do; templates in `emailService.js` and `smsService.js` hardcode `MySlot.LK`
- [ ] Add `sms_events` platform-config key (array of message keys with SMS enabled; default = all transactional keys) + `getSmsEvents()` in `featureFlags.js`; `smsService.sendSms`/catalog SMS channel checks membership
- [ ] Keep `sms_enabled` as the master kill-switch; `sms_events` is the per-key control (recorded this way so owner-SMS can be toggled once SMSGo bills)
- [ ] Admin config surface: list `sms_events` in `adminConfigController` config read (read-only display is fine — no new editor UI unless trivial)
- [ ] Record ADR-0023 — notification catalog + channel scope, superseding the SMS restriction in ADR-0012; update `.env.example` comments for `SMSGO_*`
- [ ] CONTEXT.md already updated (Email/SMS Notification scope, Booking Alert) — verify it still matches the shipped behavior
- [ ] `npm test` green