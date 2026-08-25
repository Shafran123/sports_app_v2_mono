# 06 — User-app widget flow: business header + venue step

**What to build:** The embed and branded page's booking flow (BookPanel / widget-embed / book-panel) moves from single-venue to instance-driven: business brand chrome, an optional venue selector, and the instance key passed to checkout.
- `apps/user/src/app/embed/[key]/page.tsx` + `widget-embed.tsx`: key param now means instance. Config response adds business name/brand + venues list + `defaultVenueId`/`allowVenueChoice` (see 04). Header/title bar renders Business name + brand colors/logo, not venue chrome (venue name shows inside the venue step).
- BookPanel gains a **venue step** at the top of the flow:
  - `allowVenueChoice = true` AND ≥2 eligible venues → selector shown (list: name, maybe sport/photos thumbnail), Default Venue preselected
  - `allowVenueChoice = true` AND ≤1 venue → hidden, single venue bookable
  - `allowVenueChoice = false` → hidden, only Default Venue bookable (still shown in an info line)
  - Fallback: default venue no longer eligible (e.g. suspension) → selector-on with no preselect (server already degrades the scope; client just renders venue list)
  - Changing venue resets date/slot/court selection (switch venue → pick date → pick slot), and checkout always sends the instance key (see 05).
- Identity/phone step is instance-scope-agnostic (unchanged); success screen unchanged.
- `BookPanel` is reused by the Branded Venue Page (`[slug]`) — it must continue to render from a single-venue mode there: pass the venue + its business (no venue step on the branded page; that page is per-venue by design).
- Widget components tolerate a brand-less `{}` (platform defaults) and a single-venue business.
- Tests: widget tests in `apps/user` — venue step appears for 2-venue instance, hidden when locked or single-venue, preselect honored, date/slot reset on venue change, checkout carries the instance key; `[slug]` page renders without a venue step.

**Blocked by:** 04, 05

**Status:** ready-for-agent

- [ ] Config consumed as instance payload (business brand + venues + defaults)
- [ ] Venue step component with preselect + locked/single-venue hiding + reset-on-change
- [ ] Checkout call passes `widget_instance_key`
- [ ] Branded page continues single-venue (no step) with business chrome
- [ ] Widget unit/widget tests updated