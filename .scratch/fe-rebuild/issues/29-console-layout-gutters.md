# 29 — Admin/owner console layout gutters

**Status:** ready-for-agent
**Depends on:** 24 (spec)

## What to build
- Standardize the admin/owner shell (`apps/admin/src/app/(shell)/layout.tsx` + pages):
  - Mobile: `px-5 pt-5 pb-24` (enough bottom padding for the new bottom nav), consistent `mx-auto max-w-*` per page.
  - Desktop (`lg:`): `lg:px-8 lg:pt-8`.
  - Remove the oversized top padding below the sticky header; content should not feel cramped or have uneven left/right gutters.
- Sweep the dashboard, front desk, venues, admin venues, calendar, bookings, approvals pages to use the same gutter pattern (drop per-page `px-4`/`px-6` inconsistencies).

## Acceptance
- [ ] All console pages have consistent left/right gutters on mobile and desktop
- [ ] No excessive top padding below the header
- [ ] Bottom nav doesn't overlap content (content has bottom padding)
- [ ] Desktop still uses the sidebar with matching content gutters