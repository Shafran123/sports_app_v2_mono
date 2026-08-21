# 25 — Mobile header + hero search (player app)

**Status:** ready-for-agent
**Depends on:** 24 (spec)

## What to build
- `player-nav.tsx`: on mobile, right-align a **borderless icon pair** (bell + avatar). Remove the bell's bordered-circle bg; both icons plain, consistent sizing/gap. Unread dot stays.
- `hero.tsx`: on mobile the search input spans the full width with `h-14` and larger text; "Find Sports" button is full-width below the input (stacked). Desktop unchanged.
- Keep the search bar out of the mobile header (it stays in the hero only).

## Acceptance
- [ ] On mobile, bell + avatar are right-aligned, visually identical (no bg chip), no gap/alignment mismatch
- [ ] Hero search input is full-width on mobile with `h-14` and comfortable text size
- [ ] "Find Sports" button full-width, stacked under the input on mobile
- [ ] No layout shift when the unread badge appears