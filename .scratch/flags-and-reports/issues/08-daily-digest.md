# 08 — Daily admin digest email

Type: task
Status: ready-for-agent

## Purpose

Admins get a 6am summary without logging in.

## Changes

- New job in `sp_be/jobs/dailyDigest.js` — setInterval to 06:00 Asia/Colombo (`+05:30` fixed, no DST; reuse colomboToday helper / extract `utils/colombo.js`).
- Recipients: all Admin accounts.
- Content: HTML tables (no charts in email): revenue today (net), tax collected today, bookings today (confirmed/checked-in/completed), by sport, by venue, online-vs-cash, event registrations, recent issues (pending approvals, unverified phone count).
- Fire-and-forget Mailgun; sent even when 0; no intra-day retry.

## Audit

- [ ] job wired in index.js next to reminders; first run after 06:00 sends.
- [ ] digest uses same Asia/Colombo boundaries as Reports; revenue excludes tax.
- [ ] tests render HTML without throwing; no send when Mailgun unconfigured (log).

Blocked by: 05, 07
## Completed

Implemented. Evidence: sp_be commit `b50c281` (backend) + root commit `2a1b4ed` (frontend/types/spec). Backend suite 214/214, user 39/39, admin 11/11, api 22/22 green; all packages typecheck.
