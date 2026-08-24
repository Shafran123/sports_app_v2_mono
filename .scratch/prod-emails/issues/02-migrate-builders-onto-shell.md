# 02 — Migrate 17 email builders onto the new shell

**What to build:** move every `buildXxxHtml` out of `emailService.js` into the pure `emailTemplates.js`, using the new shell; delete the old `shell()` + inline card markup.

**Depends on:** 01

**Status:** ready-for-agent

**Seam:** `notificationCatalog.js` (imports `emailService.buildXxxHtml` today).

- [ ] Move verbatim (with brand param) into `emailTemplates.js`: `buildBookingHtml, buildOwnerBookingHtml, buildReminderHtml, buildWelcomeHtml, buildVenueApprovedHtml, buildVenueRejectedHtml, buildBillHtml, buildRegistrationBillHtml, buildPlayerCancelledHtml, buildOwnerBookingCancelledHtml, buildVenueCancelledHtml, buildEventRegisteredHtml, buildEventCancelledHtml, buildEventCancelledOwnerHtml, buildOwnerWelcomeHtml, buildOwnerRenewalHtml, buildOwnerNudgeHtml`.
- [ ] Wrap each through the new shell: preheader (e.g. "Your booking at Smash Arena is confirmed"), primary CTA (player emails → CTA "View booking"/"View details" `FRONTEND_URL/bookings`; venue-owner → "Open console" `FRONTEND_URL`/console route; admin digest/lead → no CTA or console), venue-address/phone row where a booking exists (data wired in 03), plain-text block derived from the same content.
- [ ] `emailService.js` re-exports the builders (thin re-export) so `notificationCatalog.js` imports keep working during the transition; delete the old `shell()`.
- [ ] Owner keyword note: **no** player data (name/email/QR) inside owner-facing emails; keep the "you have a new booking" summary shape.
- [ ] Tests: existing `emailService.test.js` + `notificationCatalog` tests still green (snapshot-free, content assertions updated to the new markup: still contains venue/court/time/total).
- [ ] `npm test` green.

## Comments

This is the biggest content ticket; preserve every literal currently asserted in tests (e.g. "Booking confirmed —", "Show the QR", "Total:", "Pay at venue") to minimize test churn.