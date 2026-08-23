# 07 — Acceptance walkthrough

Status: ready-for-agent

## Scope

Full-page verification of the revamp, end to end.

## Checks

- `pnpm --filter @myslot/landing test` (includes updated inquire-form and screenshots tests), `typecheck`, `build` all green.
- Manual walkthrough at **375px** and **1440px** with the dev backend running (`pnpm --filter @myslot/landing dev` + `sp_be` on :2400):
  1. Nav: "For players" link opens the player app URL; "List your venue" scrolls to the form.
  2. Hero: primary CTA reads **"Book a demo with us"** and scrolls to `#inquire`; hero phone frame renders the mockup (or the real shot once `public/shots/hero-player.png` exists).
  3. Photo strip renders between How-it-works and Features; all alts present.
  4. Five owner feature sections, each with a device-framed mockup; trial band has **no button**.
  5. Two player sections render after the trial band; "Explore the player app" CTA links out.
  6. Social-proof strip between player sections and the form.
  7. Form submit button reads **"Book a demo"**; submitting with name + email succeeds and the lead appears in the admin console triage (Owner Lead pipeline unchanged).
- No layout overflows at either width; no console errors.

## Out of scope (still pending client action)

- Client drops the 8 screenshots into `public/shots/` and flips the one-line `src` per entry (ticket 04 handoff).
- Client tunes DRAFT copy (social-proof numbers/quotes, photo captions).
- Partner venue photos replacing the Unsplash stand-ins.