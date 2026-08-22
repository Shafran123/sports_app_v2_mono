# 40 — Admin + owner pages still lack left/right padding

**Status:** ready-for-agent
**Depends on:** 24 (spec)

## What to build
- Admin and owner console pages still render content flush to the screen edges — no left/right padding.
- Ticket 29 defined the gutter pattern (`px-5 pt-5 pb-24` mobile, `lg:px-8 lg:pt-8` desktop) but it's not applied on the pages the user is looking at.
- Sweep **all** admin/owner pages (dashboard, front desk, venues, admin venues, calendar, bookings, approvals) and apply the shared gutter pattern; drop per-page `px-4`/`px-6` inconsistencies.

## Acceptance
- [ ] All console pages have consistent left/right gutters on mobile and desktop
- [ ] Content never touches screen edges
- [ ] Bottom nav doesn't overlap content (content has bottom padding)

## Notes
- Screenshot: 2026-08-22 10.11.38.