# 0019 — Event discovery 3-state: platform-level flag, not per-event

- **Status:** accepted
- **Date:** 2026-08-22

## Context

Sales channels (events) may need to pause cheaply at launch — coming soon vs hidden vs live — without touching individual Event rows or owner-side expectations.

## Decision

A single platform flag `events_discovery_state` ∈ {`enabled`, `coming_soon`, `hidden`} controls how Events surface to players. State is the only filter — flipping back to `enabled` re-publishes every Event without migration. The player app renders teaser cards in `coming_soon` (photo, city, date, name + "Listing paused by " brand tag; no notify-me), removes the Events section in `hidden`. Venue-owner console is unaffected except a "Listing paused by <Brand>" banner; creation continues.

## Trade-offs

- Global switch vs per-event toggles: the global is trivial to operate and to reason about; per-event visibility is a future enhancement (deferred).
- Notify-me/waitlist deliberately out of scope — a separate feature when real demand shows.