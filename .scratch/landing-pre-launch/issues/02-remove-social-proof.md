# 02 — Remove the social-proof strip

Status: ready-for-agent

## Scope

Delete the fabricated stats (50+ / 10k+ / 5k+) and invented testimonials. The platform has no customers yet; fake social proof is worse than none.

## Implementation

- `src/lib/copy.ts`: delete the `socialProof` block (stats, testimonials, and the `draft` flag).
- Delete `src/components/social-proof.tsx`.
- `src/components/landing-page.tsx`: remove the `SocialProof` import and `<SocialProof />`.
- `src/lib/copy.test.ts`: remove the "declares draft social proof stats and testimonials" test.
- `src/components/landing-page.test.tsx`: remove the "renders the social proof stats and testimonials" test.

## Acceptance

- No "50+", "10k+", "5k+" or invented quotes anywhere.
- No references to `socialProof` or `social-proof` in the codebase.
- `pnpm --filter @myslot/landing test`, `typecheck`, `build` green.