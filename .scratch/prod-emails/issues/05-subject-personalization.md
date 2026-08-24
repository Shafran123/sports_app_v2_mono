# 05 — Subject personalization + brand reads

**What to build:** player-first-name subject lines on confirm/reminder/cancel; brand from config used in subjects (not just bodies).

**Depends on:** 02, 03

**Status:** ready-for-agent

**Seam:** `notificationCatalog.js` `buildEmail` subjects.

- [ ] Personal-name subjects (fall back to generic when absent):
  - `booking.confirmed` → `"Kasun, your court at Smash Arena is booked"`
  - `booking.reminder` → `"Reminder, Kasun — your booking at Smash Arena is tomorrow"`
  - `booking.cancelled.player` → `"Kasun, your booking at Smash Arena was cancelled"`
- [ ] Name = first token of `player_name` (already loaded); hard-fallback string keeps every subject readable when no name.
- [ ] Confirm/digest subjects already read `ctx.brand`; sweep remaining hardcoded "MySlot.LK" to `ctx.brand` (none should remain).
- [ ] Tests: subject for a booking with `player_name: 'Kasun Perera'` starts `'Kasun,'`; empty name → generic; `brand_name` override shows in subject.
- [ ] `npm test` green.

## Comments

Player-cancel subject included per grill Q6 (personalise confirm/reminder; the cancel is a natural third). Owner/admin subjects stay unchanged.