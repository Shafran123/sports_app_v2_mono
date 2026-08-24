# 03 — Player booking notifications onto the catalog

**What to build:** move the player-facing booking sends onto `dispatch`, and add the missing ones.

**Depends on:** 01, 02

**Status:** ready-for-agent

- [ ] `booking.confirmed` (player): email (existing `buildBookingHtml`), SMS (existing `buildBookingSms`), in-app row — replaces `utils/notify.js` + the inline row in `paymentController.js:165` / `bookingController.js`
- [ ] `booking.reminder` (player): email + **SMS (NEW — currently email-only)**; `jobs/reminders.js` swaps `emailService.notifyBookingReminder` for dispatch
- [ ] `booking.bill` (player): email with PDF attachment — `billService.js:181` + `:198` move to dispatch (builders must pass `attachment`)
- [ ] `booking.cancelled.player` **NEW**: player email + SMS + in-app row, fired from `bookingController.cancelBooking` (player-initiated)
- [ ] `booking.cancelled.owner` **NEW**: player email + SMS + in-app row (from `businessController.cancelBooking`)
- [ ] `booking.cancelled.admin` **NEW**: player email + SMS + in-app row; admin cancels keep working from `paymentController:258` / `businessController:649`
- [ ] `booking.walkin_created` **NEW**: player SMS from `businessController.manualBooking` (no email — walk-ins are print/phone-first; see `billService` walk-in skip rule)
- [ ] Delete `utils/notify.js` once all booking sends are dispatched
- [ ] Tests: cancel trio sends correct channels per role; walk-in SMS only; reminder marks `reminder_sent_at` only on success
- [ ] `npm test` green