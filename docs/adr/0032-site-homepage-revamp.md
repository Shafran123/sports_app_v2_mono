# ADR-0032 — Dedicated site homepage revamp

Status: Accepted

## Context

The first version of the white-labeled site home (ADR-0031) was reviewed on
`http://mysite.localhost:3000/` and found wanting: the brand-tinted page
background looked muddy (especially on mobile), the header was cramped and
old-looking, hero imagery was a single static image, and the site shipped
without legal pages. The owner-facing flow also auto-opened a "pick a venue"
popup on every first visit and showed a "Switch venue" pill even on the home
page.

## Decision

Revamp the Dedicated Site presentation layer:

- **Neutral background.** The `--brand-bg` brand-tint (primary mixed at 5%)
  is removed from the site pages; the background is always the neutral
  `--paper`/`#fafaf7` value. Brand colors remain on buttons, links, accents
  and the venue detail card's border — never as a page wash.
- **Site Gallery.** A per-Business slide set drives the hero carousel:
  1–6 slides, each an image URL plus an optional caption (max 120 chars).
  Replaces the single `hero_image` field — an existing `hero_image` becomes
  slide 1 when the owner first saves a gallery. Sites with no gallery fall
  back to the venue-first photo chain. The carousel auto-rotates (5s),
  pauses on hover/focus and when the tab is hidden, respects
  `prefers-reduced-motion` (no autoplay), and supports arrows, dots and
  touch swipe.
- **Venue photos carousel.** The venue detail ("branded venue page") shows
  all of the venue's photos in the same carousel component (no captions),
  instead of a single cover.
- **Slim header.** Sticky header keeps just the logo (larger, unboxed) and
  the business name next to the sign-in control. The tagline moves into the
  hero, not the header. The header layout stacks cleanly on mobile with
  comfortable tap targets.
- **Venue switch only on venue pages.** The auto "pick a venue" popup and
  the `/?pick=1` force-open behavior are deleted. A venue chooser (reusing
  the existing "Choose a venue" dialog) appears in the header **only** on
  `/slug` detail pages of businesses with 2+ venues. With exactly one
  approved venue, the home page auto-redirects to that venue's page,
  skipping the portfolio root entirely.
- **Site Policies.** Per-Business privacy policy and terms & conditions
  text (brand fields, editable by the owner in the admin brand editor).
  The site footer always links Privacy and Terms; until the owner saves
  their own copy, short platform-authored defaults render with the business
  name substituted.
- **Dialog-based sign-in.** The header account flows (sign-in/register and
  the signed-in account menu) move from absolutely-positioned dropdowns to
  the platform Radix Dialog, so overlay/outside-click and Escape close them
  on every viewport (this fixes a real bug: the dropdown did not close on
  outside click on mobile).
- **Mobile pass.** Hero full-bleed with overlay caption, larger card
  padding and touch targets. A sticky bottom "Book now" bar on venue detail
  is deliberately deferred to a later pass.

Superseded parts: ADR-0031's brand-tinted page background (`--brand-bg`).

## Consequences

- `Brand` gains `gallery`, `privacy_policy` and `terms_conditions`; the old
  `hero_image` remains accepted for back-compat and is migrated on save.
- Home page behavior (pick popup, `/?pick=1`, switch pill) is removed — the
  header venue chooser becomes the only switching affordance, on detail
  pages only.
- No schema/migration changes: everything lives in the existing `brand`
  JSONB object (the MERGE update semantics from ADR-0031 already support
  partial writes).