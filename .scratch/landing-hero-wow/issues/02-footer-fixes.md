# 02 — Footer: remove player column, working Contact mailto

Status: ready-for-agent

## Scope

Fix dead footer links and remove the "Explore the player app" link. "Contact" becomes a working `mailto:`; "About" placeholder and the whole "Players" column are removed.

## Implementation

- `src/lib/copy.ts`:
  - Add `footer.contactEmail: "info@myslot.lk"` — **note**: the client wrote `info@myslots.ls`, which is a probable typo for `info@myslot.lk` (repo brand = MySlot.LK, CONTEXT.md). Confirm with the client before finalizing; it's a one-string swap if different.
  - `footer.columns`: remove the "Players" column (the "Explore the player app" link) and the "About" `#` link; keep the Company column with only a "Contact" link.
- `src/components/footer.tsx`: render links generically — but "Contact" must be a real `mailto:` anchor. Simplest: keep `columns` shape, and make the renderer use `mailto:` when `link.type === "mail"` or make the Contact entry an `<a href={`mailto:${copy.footer.contactEmail}`}>`. Add a `type` field to the link objects (`{ label, type: "mailto" }` or `{ label, href }`), or special-case by label — cleanest: add an optional `mailto` boolean on the Company column links.
- Tests: `landing-page.test.tsx` footer assertions update — no "Explore the player app" link, no "About" link, a `mailto:info@myslot.lk` "Contact" link exists.

## Acceptance

- Footer shows: brand + tagline, Product column (Features / How it works / List your venue), Company column with only "Contact".
- No "Players" column; no "Explore the player app" anywhere on the page.
- "Contact" opens `mailto:info@myslot.lk` (or confirmed alternate).
- `pnpm --filter @myslot/landing test`, `typecheck`, `build` green.