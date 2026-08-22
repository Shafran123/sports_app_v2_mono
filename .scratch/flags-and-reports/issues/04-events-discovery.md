# 04 — Event discovery state (enabled / coming_soon / hidden)

Type: task
Status: ready-for-agent

## Purpose

Admin flips how Events surface to players without touching individual events.

## Changes

- `events_discovery_state = 'coming_soon'` → player app shows teaser cards (photo, city, date, name, "Listing paused by " tag with brand name), no purchase action, no notify-me.
- `'hidden'` → player app hides the Events section entirely.
- `'enabled'` → current listing behavior.
- Venue-owner events console shows a `Listing paused by <brand>` banner when state != `enabled`; create/update continue.
- Backend: `eventController.listEvents` + `register` filter/purchase gate based on flag (server-side source of truth).

## Audit

- [ ] Server rejects registration when not `enabled`; player UI shows teasers; admin console unaffected.
- [ ] Flipping back to `enabled` auto-publishes (no per-event migration).
- [ ] Brand name from platform config.

## Done

- [ ] tests both states.
- Blocked by: 01