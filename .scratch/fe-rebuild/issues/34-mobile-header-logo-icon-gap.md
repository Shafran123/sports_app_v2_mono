# 34 — Mobile nav bar: no gap between logo and notification/profile icons

**Status:** ready-for-agent
**Depends on:** 24 (spec)

## What to build
- On the mobile player header, the logo sits flush against the notification (bell) and profile icons — there is no gap between the logo and the icon group.
- Add consistent spacing between the logo and the right-aligned icon pair (bell + avatar), matching the spacing between the two icons themselves.
- Check `player-nav.tsx` (see ticket 25 for the icon-pair work) and any other mobile header (owner/admin shell header) that renders logo + icons.

## Acceptance
- [ ] Visible gap between logo and bell/avatar on mobile header
- [ ] Gap consistent with spacing between the icons themselves
- [ ] No layout shift when unread badge appears

## Notes
- Reported still broken after ticket 25. Verify against a fresh build, not a stale dev server.