# 03 — Home, venue discovery, and venue detail

**What to build:** the wow surfaces. Home gets the signature dark hero (giant Sora headline, lemon "Find Sports" pill, dark court imagery); venue cards get photos + lemon price numerals; the venues list gets dark filter chips and slot-picker states; venue detail gets a gallery, info grid, and the booking CTA in lemon. All placeholder images move to the curated sport imagery map.

**Blocked by:** 01 — Design system; 02 — App shells.

**Status:** ready-for-agent

- [ ] Home: hero with giant numerals/headline, sport chips from `/sports`, nearby venue cards with image + "from Rs X" lemon numerals; skeletons shimmer
- [ ] `/venues`: filter bar + chips, result cards with imagery; loading/empty/error in new primitives
- [ ] `/venues/[id]`: hero image, court cards, slot chips with dark state colors (lemon selected, grayed taken); continue CTA pill
- [ ] Imagery map replaces all picsum URLs; venueless sport fallback = gradient + icon
- [ ] Mobile 375px and desktop 1440px both look intentional; `npm run build` green