# 32 — Real-time front desk + owner calendar (Socket.IO)

**Status:** ready-for-agent
**Depends on:** 24 (spec), 30 (no; independent)

## What to build
Backend (`sp_be`):
- Add `socket.io` on the same HTTP server (`index.js` currently `app.listen`; attach to `http.createServer(app)`).
- Socket connection authenticated with the existing Firebase/JWT token (reuse verify path in `middleware/authenticate.js`); join room `owner:<id>` for venue_owner/admin.
- Emit room events whenever booking state changes in: checkout (cash + online confirm), mark-paid, check-in, no-show, cancel (owner + player), manual/quick book:
  - `booking.created`, `booking.checked_in`, `booking.marked_paid`, `booking.cancelled`, `booking.no_show` — payload includes the booking row.
- Graceful: unknown token → reject; sockets don't break HTTP flows; tests green.

Frontend (`apps/admin`):
- Small socket client hook (e.g. `hooks/use-realtime.ts`) that connects, joins the owner room, and `invalidateQueries` for `front-desk-bookings`, `admin-bookings`, calendar/availability queries on each event.
- Socket URL from env (`NEXT_PUBLIC_SOCKET_URL` default `http://localhost:2400`); no-op in tests/build without a server.

## Acceptance
- [ ] Owner places a booking on the player app → front desk "Today" updates without refresh
- [ ] Mark paid / check-in / no-show / cancel update the front desk + calendar live
- [ ] Socket auth rejects bad tokens; HTTP unaffected
- [ ] Owner console works with socket server unreachable (falls back to current polling/refetch)
- [ ] Backend + frontend test suites still green