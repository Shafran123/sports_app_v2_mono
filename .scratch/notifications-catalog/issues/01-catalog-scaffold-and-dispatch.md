# 01 — Catalog scaffold + dispatch

**What to build:** `sp_be/utils/notificationCatalog.js` — the registry and dispatch core. Every message key maps to a channel plan (`{ email?, sms?, inApp?, roles }`) and template builders; `dispatch(key, payload)` resolves recipients by role, fans out fire-and-forget to the in-app / email / SMS channels, and returns without throwing.

**Status:** ready-for-agent

- [ ] Registry shape: key → `{ channels: { inApp?: boolean, email?: boolean, sms?: boolean }, roles: ['player'|'owner'|'admin'|'registrants'], buildInApp?, buildEmail? -> {subject, html, attachment?}, buildSms? -> string }`
- [ ] `dispatch(key, payload)`: looks up registry; resolves recipients per role (player/owner from payload, admins via `users where role='admin'`); runs each enabled channel inside its own try/catch; never throws; logs failures like today's `.catch` call sites
- [ ] In-app channel writes `notifications (user_id, type=key, title, body)` for `inApp` keys — replaces the inline insert in `paymentController.js:165` and `leadsController.js:38`
- [ ] Email channel calls `emailService.sendEmail`; SMS channel calls `smsService.sendSms` (looping when a role resolves to multiple recipients)
- [ ] Register one tracer-bullet message end-to-end first: `booking.confirmed` (player + owner, email + sms + in-app) so the scaffold is exercised before the rest land
- [ ] Unit tests: registry validation (unimplemented key throws at boot), dispatch fire-and-forget (transport failure doesn't propagate), multi-recipient fan-out
- [ ] `npm test` green

## Comments

Scope decided in grill: catalog fans out email + SMS + in-app in one call; owner notified on confirm + cancel; OTP stays a direct `sendSms` call (it needs the synchronous result).