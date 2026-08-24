# 03 — Venue contact data plumbing (loader + catalog)

**What to build:** make venue address, city and phone available to every booking email; make the player's first name available for subject personalization.

**Depends on:** 02

**Status:** ready-for-agent

**Seam:** `sp_be/utils/bookingLoader.js` + `sp_be/utils/notificationCatalog.js`.

- [ ] `bookingLoader.js` `BOOKING_EVENTS_SELECT`: add `v.address as venue_address, v.city as venue_city, v.phone as venue_phone` (left-join already carries `v`).
- [ ] `notificationCatalog.js` `recipientsForBooking`/`recipientsForRegistration`: pass through `venue_address/venue_city/venue_phone` into `ctx.payload.booking` (already spread by the builder via `payload.booking`).
- [ ] Templates (`emailTemplates.js`, ticket 02 contract): venue row `<venue_name> · <city> · <phone>` in confirm/reminder/bill/player-cancel when present.
- [ ] `player_name` already loaded; ensure the catalog subject builders (05) can read `booking.player_name` (first token).
- [ ] Tests: loader returns venue contact; confirm email contains the venue phone when fixture has it; absent → row omitted.
- [ ] `npm test` green.

## Comments

No migration needed — `venues` already has address/city/phone. Walk-in bookings carry the venue's address (correct — they go to the venue).