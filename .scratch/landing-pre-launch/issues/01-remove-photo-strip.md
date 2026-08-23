# 01 — Remove the photo strip

Status: ready-for-agent

## Scope

Delete the "Real courts, real games" section entirely. It was an Unsplash/LoremFlickr stand-in for partner venue photos that don't exist yet.

## Implementation

- `src/lib/copy.ts`: delete the `photoStrip` block.
- Delete `src/components/photo-strip.tsx`.
- `src/components/landing-page.tsx`: remove the `PhotoStrip` import and the `<PhotoStrip />` element.
- Delete assets `apps/landing/public/photos/court-badminton.jpg`, `court-turf.jpg`, `court-cricket.jpg` (the `public/photos/` dir becomes empty after ticket 03 moves the shots out).
- `src/lib/copy.test.ts`: remove the "declares a photo strip with three photos carrying src and alt" test.
- `src/components/landing-page.test.tsx`: remove the "renders the photo strip with real court images" test.

## Acceptance

- No "Real courts, real games" / "Made for the venues players already love" copy anywhere.
- No references to `photoStrip` or `photo-strip` in the codebase.
- `pnpm --filter @myslot/landing test`, `typecheck`, `build` green.