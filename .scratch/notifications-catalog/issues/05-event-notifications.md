# 05 — Event notifications onto the catalog

**What to build:** notifications for Event Registrations and Event cancellations — both silent today.

**Depends on:** 01, 02

**Status:** ready-for-agent

- [ ] `event.registered` (player): email + SMS + in-app row, fired from `eventController.js` registration success (~line 217) — and from `paymentController.js` PayHere confirm for registrations (~line 61-72)
- [ ] `event.cancelled` (registrants): email + SMS to every registrant with `status in ('pending','paid')`, fired from `eventController.cancelEvent` (line ~138)
- [ ] `event.cancelled` (organizer): email only to the venue-owner who created the event — per grill decision, registrants get both channels, organizer gets email trail
- [ ] Refund-state copy in the cancellation message: refunds are marked `needs_manual_refund` today, so the email must not promise an automatic refund
- [ ] Tests: registrant fan-out on cancel; organizer email; no notification when an event has no registrations
- [ ] `npm test` green