# 47 — Admin app can't scroll to the bottom of a page

## What happened
- In the admin (and owner) app the last rows/cards of a page can't be reached — scrolling stops short of the bottom content.

## Root cause (found)
- The fixed console bottom nav (`ConsoleBottomNav`, `fixed inset-x-0 bottom-0`) covers the last ~4rem of the viewport, and pages have **no bottom padding** because the shell `<main>` wrapper is dead (see 45/46 — `pb-28` was never applied). The last card sits permanently behind the nav.

## Fix
- Part of the 45/46 shell fix: `pb-28` on the `<main>` wrapper guarantees clearance above the bottom nav on mobile.

## Acceptance
- [ ] Admin every page's last row/card scrolls fully above the bottom nav
- [ ] Owner pages too
- [ ] Desktop unaffected (no bottom nav; `lg` padding unchanged)