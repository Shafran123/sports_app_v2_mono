# 03 — Court photo strip (Unsplash)

Status: ready-for-agent

## Scope

Add a photo band of real courts (badminton, football turf, cricket nets) between the How-it-works strip and the Features block. Stands in for partner venue photos the client will supply later.

## Implementation

- Download 3–4 court photos from Unsplash (free license) at implementation time into `apps/landing/public/photos/` — e.g. `court-badminton.jpg`, `court-turf.jpg`, `court-cricket.jpg`. Square-ish crop or consistent aspect (e.g. 4:3).
- New component `src/components/photo-strip.tsx`: a full-width band, images with `alt` text ("Badminton courts in Colombo" style, DRAFT), consistent with the light-premium identity (ADR-0005: paper/ink/primary).
- `src/lib/copy.ts`: add a `photoStrip` block (eyebrow, title, per-photo alt captions) — DRAFT wording.
- Wire into `src/components/landing-page.tsx` between `<HowItWorks />` and the features section.
- Plain `<img>` is fine (consistent with `DeviceFrame`); no new runtime deps.

## Acceptance

- Photos render on mobile (375px, stacked or single column without overflow) and desktop (1440px).
- Each photo has an alt attribute; no missing-asset errors on `build`.
- `pnpm --filter @myslot/landing test` and `typecheck` green.