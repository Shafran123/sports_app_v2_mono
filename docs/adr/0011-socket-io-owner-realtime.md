# 0011 — Socket.IO for real-time owner console updates

- **Status:** accepted
- **Date:** 2026-08-21

## Context

The owner "Front desk" and calendar must reflect new/changed bookings the instant they happen — a player booking online should appear on the owner's screen without a manual refresh. Options considered: Socket.IO, Server-Sent Events, short polling.

## Decision

Use **Socket.IO** on the same HTTP server as the REST API. Connections authenticate with the existing Firebase/JWT token and join a room per owner (`owner:<id>`). The backend emits `booking.created`, `booking.checked_in`, `booking.marked_paid`, `booking.cancelled`, `booking.no_show` on the room whenever booking state changes. The owner console connects, joins its room, and invalidates its React Query caches on events; it falls back to refetch/polling when the socket is unreachable.

## Why

- Push, low latency, works through the same auth model; the player app stays on polling (no need to move it yet).
- SSE gives one-way push but still needs a manual event-type convention and reconnection handling; Socket.IO gives rooms, acknowledgements, and reconnect/backoff out of the box.
- Polling alone adds load and latency and still needs the owner to wait for a refresh.

## Consequences

- A new long-lived connection path alongside REST; must handle auth rejection and reconnection gracefully.
- Event payloads reuse the same booking row the REST endpoints return, so clients parse one shape.
- Player app intentionally unchanged (polling) — moving it to sockets later is a contained follow-up.