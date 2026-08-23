# 01 — Demo CTA relabel

Status: ready-for-agent

## Scope

Rename the page CTAs per the spec's CTA map, in `apps/landing/src/lib/copy.ts`:

- `copy.hero.primaryCta`: "Start your 3-month free trial" → **"Book a demo with us"**
- `copy.inquire.submit`: "Start your 3-month free trial" → **"Book a demo"**
- `copy.trialBand.cta`: remove the key — the trial band button goes away (see below); keep `copy.trialBand.title` / `sub` ("List your venue free for 3 months" offer text stays)

Optionally tune `copy.inquire.body` to mention a demo ("we'll reach out to set up a demo, your listing, and your 3-month free plan") — DRAFT wording, client-tunable.

## Implementation

- `src/components/trial-band.tsx`: remove the `<a>` CTA and the `trackCta("trial-band")` handler; keep the title/sub block (text-only band).
- `src/components/inquire-form.tsx`: no code change (reads `copy.inquire.submit`), but verify the button renders "Book a demo".
- `src/components/inquire-form.test.tsx`: update the two `/3-month free trial/i` assertions to `/book a demo/i`.
- `src/lib/copy.ts`: the 3-month offer must still appear in hero body, how-it-works step 2, trial band text, and inquire body — the *offer* is unchanged, only button labels.

## Domain note

Add to the Owner Lead entry in `CONTEXT.md` a `_Note_`: a demo request submitted through the landing page is an Owner Lead (same form, same `/public/leads` pipeline); add "demo request" to `_Avoid_`. No backend change.

## Acceptance

- Hero primary button: "Book a demo with us", scrolls to `#inquire`.
- Form submit button: "Book a demo".
- Trial band: no button, offer text intact.
- No other "free trial" *button* copy anywhere (offer text allowed).
- `pnpm --filter @myslot/landing test`, `typecheck`, `build` green.