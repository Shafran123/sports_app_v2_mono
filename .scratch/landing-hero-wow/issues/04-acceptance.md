# 04 — Tests + acceptance walkthrough

Status: ready-for-agent

## Scope

Update the test seams for this pass and verify the page end to end.

## Implementation

- `src/components/landing-page.test.tsx`:
  - Nav no longer above hero: assert the hero CTA renders; assert no nav-brand link is present within the first printed element order… simplest robust check: `screen.getByRole("link", { name: "List your venue" })` still exists (desktop nav) and the hero still renders — the ordering is visual and covered by the manual walkthrough.
  - Footer: no "Explore the player app"; no "About"; "Contact" links to `mailto:`.
  - `getByText(/be one of the first venues/)` stays (trial band).
- `src/lib/copy.test.ts`: add assertions for `footer.contactEmail` (matches `mailto:` in the footer href) and that no footer column is titled "Players".
- Keep the existing seams: copy config, screenshot config, page composition. No new seams beyond the footer/contact additions.

## Acceptance checklist (manual, 375px + 1440px)

1. Load: hero fills the viewport, no nav above, staggered entrance (headline → sub → CTA → phone), phone floats gently.
2. Scroll cue at hero bottom → `#how-it-works`.
3. After scrolling past hero: slim sticky nav (desktop) / green band (mobile) appears; each section reveals once as it scrolls into view.
4. Footer: Product + Company(Contact) only; "Contact" opens `mailto:info@myslot.lk`; no "Explore the player app", no "About".
5. `pnpm --filter @myslot/landing test`, `typecheck`, `build` green.

## Out of scope / client follow-ups

- Confirm `info@myslot.lk` vs `info@myslots.ls` (one-string swap if the latter).
- Real partner venue photos (still absent — photo strip stays removed).