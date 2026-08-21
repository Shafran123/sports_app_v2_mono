# Mobile polish, real-time front desk, transactional notifications

**Status:** spec (grilled + settled)
**Date:** 2026-08-21

## Background

Client demo pass on mobile surfaced ten UI issues (header, search, bottom nav, button padding, booking detail/QR access, map link, native dropdowns, console gutters, two data bugs, sheet icon alignment). Two engineering asks alongside: the owner **front desk must update in real time** (a booking placed online should appear on the owner's screen instantly), and **transactional emails/SMS** need to actually work (config is placeholder today and cash bookings send nothing).

## Decisions (all grilled + agreed)

| # | Decision |
|---|----------|
| Q1 | Mobile header: **bell + avatar right-aligned as a plain borderless pair** (no per-icon bg circles); search stays in the hero, not the header. |
| Q2 | Hero search on mobile: **full-width h-14 input with larger text + stacked full-width "Find Sports" button**. |
| Q3 | **Bottom nav added to owner + admin** consoles on mobile (4 tabs each: owner = Dashboard/Front desk/Venues/Calendar; admin = Dashboard/Bookings/Venues/Approvals); hamburger sidebar stays for secondary actions; fix any device size where the bar is not visible (safe-area + stacking). |
| Q4 | Button padding fixed **at the shared `Button` component** (enforce horizontal padding, add full-width/block size variant). |
| Q5 | **Player booking rows become tappable** → detail bottom sheet (mobile) / dialog (desktop) **with the QR code rendered inline** + "View venue" link. All pill/tab controls get a clear **selected state**. |
| Q6 | Venue map = **"Get directions" link only** (Google Maps URL from address/city), no embedded iframe. |
| Q7 | New shared **`SelectSheet` primitive**: native `<select>` on `md+`, **bottom sheet on touch**; swap all dropdowns (explore filters, quick-book venue/court, manual booking, venue form sports). |
| Q8 | Admin/owner console layout: standard gutters `px-5 pt-5 pb-24` (mobile) / `lg:px-8 lg:pt-8`; remove the oversized top padding; consistent max-width per page. |
| Q9 | Two data bugs: **(a)** owner "0 courts" — `venues.mine()` parses with `VenueSchema` which strips `court_count` before the UI can read it; **(b)** admin sales — admin dashboard never fetches `overview` (query disabled for admins). Fix: keep `court_count` through the API layer; add **`GET /admin/overview`** (platform revenue today, bookings today, total venues, pending approvals). |
| Q10 | Icon/button alignment pass on the **quick-book** and **scan-QR** bottom sheets (icons centered, consistent hit areas). |
| Q11 | Real-time: **Socket.IO**, room per owner, token-authenticated. Owner **front desk + calendar update live** on booking created / checked in / marked paid / cancelled / no-show. Player app keeps polling. |
| Q12 | Email via **Mailgun** (100 free/month) replacing Resend; emails for **signup welcome, booking confirmation (online + cash), booking reminder, venue approved, venue rejected/changes-requested**. SMS via **SMSGo.lk** (`POST https://api.smsgo.lk/api/v1/sms/send`, `X-API-Key`) for **booking confirmation and admin-initiated cancellation only**. |

## Requirements

### R1. Mobile header + hero (player app)
- Header on mobile: brand, then a **right-aligned icon pair** — bell (with unread dot) + avatar — both borderless, no bg chip on one but not the other.
- Hero search: input spans the full width (`h-14`, larger text), "Find Sports" button full-width below it on small screens.

### R2. Bottom nav on owner + admin consoles
- Same fixed bottom-tab pattern as the player app (`md:hidden`), with `pb-[env(safe-area-inset-bottom)]`.
- Owner tabs: Dashboard, Front desk, Venues, Calendar. Admin tabs: Dashboard, Bookings, Venues, Approvals.
- Existing hamburger/sidebar remains for desktop and secondary items.

### R3. Buttons, pills, booking detail + QR
- `Button`: every size has explicit horizontal padding; add `block` (full-width) size; fix any call site that renders a bare button.
- All selectable pills (tabs, sports chips, date strip, slot pills) show an unambiguous selected state.
- Player bookings list: each row opens a detail sheet/dialog showing status, time, price, payment method, **QR code** (regenerate from `qr_token`), booking ID, and "View venue" link.

### R4. Venue map link
- Venue detail: "Get directions" link (Google Maps search URL from `address`, `city`, `lat/lng` when present). No iframe.

### R5. SelectSheet primitive
- `@spots/ui` `SelectSheet`: renders a native `<select>` on `md+`; on touch, a bottom sheet with the options as tappable rows.
- Swap: explore filters (sport), quick-book (venue, court), manual booking (venue, court), venue form (sports), anywhere else with a `<select>`.

### R6. Console layout gutters
- `(shell)` layout + pages: `px-5 pt-5 pb-24` mobile, `lg:px-8 lg:pt-8`; sticky header flush with content padding; consistent `mx-auto max-w-*` per page.

### R7. Data correctness
- **court_count**: `venues.mine()` (and any other list parse) must retain `court_count`/`courts_count` so owner venue cards show real numbers.
- **Admin overview**: new `GET /api/v1/admin/overview` → `{ revenue_today, bookings_today, total_venues, pending_approvals }`; admin dashboard renders these instead of LKR 0.

### R8. Sheet icon alignment
- Quick-book and scan-QR sheets: header close, action button icons, and step rows centered/consistent on small screens.

### R9. Real-time front desk (Socket.IO)
- Backend: `socket.io` on the same HTTP server; connection authenticated with the Firebase/JWT token; each owner joins room `owner:<id>`; events emitted on booking state changes: `booking.created`, `booking.checked_in`, `booking.marked_paid`, `booking.cancelled`, `booking.no_show`.
- Owner console: socket client hook invalidates the front-desk and calendar queries on any event.
- Player app: unchanged (polling).

### R10. Transactional email (Mailgun) + SMS (SMSGo)
- Replace `resend` with `mailgun-js`/REST in `sp_be/utils/emailService.js`; env: `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `FROM_EMAIL`; loud warning when unconfigured.
- Emails: signup welcome (sent when `upsertUser` creates a new user row), booking confirmed (online + cash, includes venue/court/time/price + QR note), booking reminder (1 day before slot), venue approved, venue rejected/changes-requested. Remove dead legacy `notifyBookingCreated/Accepted/Rejected`.
- SMS via SMSGo (`SMSGO_API_KEY`, `SMSGO_MASK`): send on **booking confirmed** (online + cash) and **admin-initiated cancellation only**. Phone = booking player phone (or user phone). Log + never throw when SMS fails.
- Non-blocking: all sends fire-and-forget, failures logged, never fail the HTTP request.

## Out of scope
- Push notifications, in-app notification for socket events, WhatsApp.
- Embedded maps.
- Real-time for the player app.