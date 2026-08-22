# 37 — Venues page returns 404

**Status:** ready-for-agent
**Depends on:** 24 (spec)

## What to build
- Navigating to the **Venues** page (owner console, `/venues`) returns a 404.
- Find whether the route is missing, misnamed, or the page file was dropped during the rebuild; the owner bottom nav (ticket 26) links to `/venues` — confirm that route exists and matches the nav target for both owner and admin venues pages.

## Acceptance
- [ ] Owner `/venues` renders the venue list (not 404)
- [ ] Admin venues route works too (`/admin-venues` or whatever the admin nav targets)
- [ ] Bottom-nav links land on the correct venue pages

## Notes
- Screenshot: 2026-08-22 10.09.00.