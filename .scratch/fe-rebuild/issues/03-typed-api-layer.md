# 03 — Typed API layer and domain types

**What to build:** the production safety net. The existing backend's JSON becomes typed, validated, and centrally consumed so every screen talks to a service layer instead of raw HTTP.

**Blocked by:** 01 — Scaffold the rebuild monorepo.

**Status:** done

- [ ] Shared domain types for User, Venue, Court, Slot, Hold, Booking, Event, Notification, and their API payloads (matches the existing backend's responses)
- [ ] A shared API package covers every endpoint the two apps need: venues (list/mine/detail), availability, checkout + holds, bookings (list/detail/cancel/manual/check-in/no-show), events (list/detail/register/cancel/create), notifications, admin (pending/approve/reject), auth (me/update)
- [ ] Responses validated with Zod; auth token attach and centralized 401 handling in one place
- [ ] Unit tests for the Zod schemas and the mocked service layer