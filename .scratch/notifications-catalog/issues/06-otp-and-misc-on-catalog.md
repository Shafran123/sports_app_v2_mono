# 06 — OTP + signup/venue/owner/lead/digest onto the catalog

**What to build:** route the remaining sends through the catalog (or the audit writer where dispatch doesn't fit), and delete the dead notification service.

**Depends on:** 01, 02

**Status:** ready-for-agent

- [ ] `signup.welcome` → `dispatch` from `middleware/authenticate.js`
- [ ] `venue.approved` / `venue.rejected` → `dispatch` from `routes/adminVenues.js`
- [ ] `owner.welcome` / `owner.renewal` / `owner.nudge` → `dispatch` from `ownersController.js` (builders must support the agreement-PDF attachment; keep `renderAgreementPdf` behavior)
- [ ] `lead.new` → `dispatch` (admins role) from `leadsController.js`; replaces the inline admin loop
- [ ] `digest.daily` → `dispatch` (admins role) from `jobs/dailyDigest.js`
- [ ] `otp.code`: keep the direct `sendSms` in `verifyPhoneController.js` (needs the synchronous result), but route its result through the audit writer per ticket 02
- [ ] Delete `services/notifications.js` (dead — no callers) and its test if one exists
- [ ] Tests: each key builds and dispatches; attachment path (owner welcome) unchanged; digest still sends when zero metrics
- [ ] `npm test` green