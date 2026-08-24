# 04 — Owner booking notifications onto the catalog

**What to build:** notify the Venue Owner about bookings on their venue — a channel that doesn't exist today. These are the rows where the owner SMS gating decision (Q8) bites.

**Depends on:** 01, 02

**Status:** ready-for-agent

- [ ] Extend `sp_be/utils/bookingLoader.js` `BOOKING_EVENTS_SELECT` to also select the venue owner's email + phone (`left join users` on `v.owner_id`) so `dispatch('booking.confirmed', ...)` can resolve the owner role
- [ ] `booking.confirmed` (owner): email + SMS — wired through the same dispatch call as the player side (ticket 03), recipient role `owner`
- [ ] `booking.cancelled.player` (owner): email + SMS when the player initiates (the owner needs to know their slot was freed)
- [ ] Owner in-app row: no (owner console uses realtime socket events — out of scope, keep untouched)
- [ ] The owner SMS send must respect the `sms_events` gate (ticket 07) so owner SMS can be turned off without code while owner email stays on
- [ ] Tests: owner email/SMS resolved from `venue_owner_id`; owner muted when `sms_events` excludes the key
- [ ] `npm test` green