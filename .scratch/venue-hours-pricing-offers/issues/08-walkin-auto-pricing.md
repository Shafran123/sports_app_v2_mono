# 08 — Walk-in auto-pricing from the rule engine

**What to build:** The owner's walk-in and quick-book dialogs auto-fill the price from the same pricing + offers engine the player sees (variable price for the slot plus any matching offers). The server derives and validates the amount — one pricing path everywhere, no drift between what the player pays online and what a walk-in pays at the venue.

**Blocked by:** 06 — Slot-based offers

**Status:** ready-for-agent

- [ ] The quick-book dialog shows the engine-derived price for the selected slot (base, rule price, or offer-discounted).
- [ ] A walk-in booking for the same court + slot as an online booking shows the same pricing.
- [ ] The server derives the authoritative amount from the engine and rejects a submitted amount that drifts from it.
- [ ] The manual/quick-book dialog reflects closed dates and horizon rules (a slot on a closed date can't be quick-booked).