# 02 — Landing page: design system, nav, footer, and page shell

**What to build:** the page shell and shared chrome on the ADR-0005 identity, plus the copy and screenshot config files that the section tickets read from.

- **`lib/copy.ts`**: one file holding every string — brand tagline, hero headline + sub, CTA labels ("Start your 3-month free trial"), how-it-works steps, feature section headings + body + bullet lists, trial band, footer columns. Comments flag which lines are draft copy awaiting client approval.
- **`lib/screenshots.ts`**: the placeholder-screenshot config array — one entry per feature (`{ id, label, frame: "phone" | "browser", swapHint }`), each with a comment explaining how to swap in a real screenshot (add `src` → `DeviceFrame` renders the image instead of the mockup).
- **Nav** (`components/nav.tsx`): wordmark ("MySlot" + green `.LK`), "Features" and "How it works" anchor links, persistent **List your venue** pill CTA scrolling to `#inquire`. Sticky on desktop, plain scroll on mobile.
- **Footer** (`components/footer.tsx`): brand line, short columns (Product, Company, Players), and a link out to the player app ("Try the player app").
- **Anchors**: `#features` and `#how-it-works` section markers so nav links have targets; the trial band and form anchor in later tickets.
- **Motion**: reuse the `@myslot/ui` keyframes (fade-up, word-roll) for hero and section entrances; respect `prefers-reduced-motion` (already handled in globals).

**Blocked by:** 01

**Status:** ready-for-human (implemented, code-level checks pass; deploy-level checks pending)

- [x] Nav wordmark matches the brand lockup, and all links/CTAs anchor correctly
- [x] Footer shows the brand line and links the player app
- [x] `copy.ts` and `screenshots.ts` compile and are the single source for section copy/screens
- [x] `turbo run build` and `turbo run typecheck` green