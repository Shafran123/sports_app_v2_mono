# Dedicated Site homepage revamp (ADR-0032)

Owner-approved design (grilled through both rounds, then agreed):

- Q1 neutral page background (drop the brand tint)
- Q2 hero = multiple slides with optional captions
- Q3 slim header; tagline moves into the hero
- Q4 switch-venue only inside a slug; 1 venue = auto-redirect to it
- Q5 owner-editable Privacy & Terms
- Q6 mobile pass (header, touch targets, cards)
- Q7 carousel: 5s autoplay, pause on hover/focus/hidden tab, respects
  reduced motion, arrows + dots + swipe
- Q8 gallery = 1–6 slides, image + optional caption, venue-first fallback
- Q9 hero_image becomes slide 1 on first gallery save (editor upgraded, not
  duplicated)
- Q10 venue detail uses the same carousel for its photos (no captions)
- Q11 switch = existing "Choose a venue" dialog, header button, detail pages
  only; auto-popup and /?pick=1 deleted
- Q12 policies = two textareas in brand editor; platform defaults (business
  name substituted) until owner writes their own; links always shown
- Q13 mobile scope as Q6; sticky bottom Book-now bar DEFERRED (later pass)
- Q14 (bug) sign-in/account dropdowns become real Dialogs — outside click
  and Escape close on mobile; confirmed from the panel code that the
  dropdown has no backdrop or click-outside handler
- Q15 gallery rows are URL + caption inputs (consistent with logo/hero)
- Q16 chooser reuses the Radix "Choose a venue" dialog + VenueStep
- Q17 home "Book now" scrolls to the venues grid (grid = the picker)
- Q18 names: **Site Gallery**, **Site Policies** in CONTEXT.md; ADR-0032 as
  filed

## Tickets

- 01 Site Gallery — schema, sanitizer, admin editor, fallback chain
- 02 Hero carousel component (autoplay/pause/reduced-motion/swipe/dots)
- 03 Venue detail photo carousel (reuse, no captions)
- 04 Slim header redesign (logo, name, sign-in; mobile stacking)
- 05 Venue switch on detail pages only; delete popup + /?pick=1 + pill
- 06 Single-venue auto-redirect home → venue page
- 07 Neutral background (remove --brand-bg wash)
- 08 Site Policies — fields, editor, /privacy + /terms routes, footer links
- 09 Sign-in/account dropdowns → Dialog (outside-click close bug)
- 10 Mobile pass (hero full-bleed overlay, touch targets, card padding)

Deferred: sticky bottom "Book now" bar on venue detail.