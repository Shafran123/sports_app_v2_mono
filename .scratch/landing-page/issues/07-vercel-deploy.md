# 07 — Vercel deploy (Next.js version detection + build)

**Status:** resolved

## Root cause (two independent bugs, both .gitignore)

1. `apps/landing/package.json` (needed by Vercel to detect Next.js and determine build/install commands) was **untracked** — the root `.gitignore` blanket-ignores `*.json`, so Vercel cloned the repo without it. Detection failed with "No Next.js version detected".
   Working apps (`apps/user`, `apps/admin`) had explicit `!` exceptions, so they deployed fine.
2. After tracking `package.json`, the build failed with `Module not found: Can't resolve '@/components/landing-page'` because `apps/landing/tsconfig.json` (which defines the `@/*` → `./src/*` alias) was **also untracked** (same `*.json` rule).

## Fix

- `.gitignore`: added `!/apps/landing/package.json`, `!/apps/landing/tsconfig.json` (and existing app exceptions).
- Committed both files; pushed `main`.

## Verification

- Vercel auto-deploy **Ready** (Production): `https://myslot-landing-v2-mahason-techs-projects.vercel.app` returns HTTP 200.
- Landed page renders (client-rendered SPA shell; landing copy present in HTML).
- Next.js 15.5.23 detected; `pnpm --filter @myslot/landing build` ran; `next build` succeeded; `�/components/landing-page` resolved.

Remaining (human, optional): DNS/custom domain — out of scope.

## Findings

- Deployment settings on Vercel (Root Directory `apps/landing`, Next preset) were **correct the whole time**; the blocking delta was git metadata.
- Existing deployments before this fix could only fail; no regression tests were possible since it never reached build.
