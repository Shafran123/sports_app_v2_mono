# 26 — Bottom nav on owner + admin consoles

**Status:** ready-for-agent
**Depends on:** 24 (spec)

## What to build
- Add a mobile **bottom nav** (same pattern as the player `bottom-tabs.tsx`, `md:hidden`, `pb-[env(safe-area-inset-bottom)]`) to the admin/owner shell:
  - Owner: Dashboard `/`, Front desk `/front-desk`, Venues `/venues`, Calendar `/calendar`
  - Admin: Dashboard `/`, Bookings `/bookings`, Venues `/admin-venues`, Approvals `/approvals`
- Keep the hamburger sidebar for desktop + secondary items.
- Ensure the bar is visible on all device sizes (no overlap with content; content gets `pb-24`-ish bottom padding).
- Ensure icons are not misplaced (consistent icon size/alignment per tab).

## Acceptance
- [ ] Owner on mobile sees 4 bottom tabs (Dashboard/Front desk/Venues/Calendar)
- [ ] Admin on mobile sees 4 bottom tabs (Dashboard/Bookings/Venues/Approvals)
- [ ] Active tab highlighted; tapping navigates
- [ ] Bar visible on small phones (safe-area inset respected) and not overlapping content
- [ ] Desktop unchanged (sidebar only)