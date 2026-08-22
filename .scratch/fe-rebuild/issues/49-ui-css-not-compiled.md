# 49 — ROOT CAUSE: ui-package classes never compiled into CSS (pill highlight invisible for 3 rounds)

**Status:** resolved
**Depends on:** 36, 44 (explains why they looked unfixed)

## Symptom
- Reported three times: "the pill doesn't highlight the selected one" (10.07, 10.44, 11.20). Fixes to `TabsTrigger` and the navs were correct but **had zero visible effect**.

## Root cause (proven)
- Tailwind v4's automatic source detection scans the consuming app's tree, but **not `packages/ui/src`** — the exact tree where `TabsTrigger` etc. live. Every utility used *only* in the ui package (`data-[state=active]:bg-primary`, `max-h-[60vh]`, SHEET_CLASS `max-h-[90dvh]`/`rounded-b-none`, `focus-visible:outline-2`, …) was silently dropped from the compiled CSS.
- Evidence loop (fetch served CSS, search for the rule):
  - `http://localhost:3000/_next/static/css/app/layout.css` (before fix): `data-\[state` → **absent**
  - after `@source "."` in `packages/ui/src/globals.css`: `data-\[state` → **present**, exact rule `.data-\[state\=active\]\:bg-primary` confirmed, `max-h-[60vh]`/`90dvh`/`rounded-b-none` all present.
- Impact: tickets 36, 41, 44, 48 (and the sheet alignment work in 31/27) had correct code whose CSS never shipped. App-level fixes (bottom nav, shell gutters, venue routes) worked because their classes live in app files.

## Fix
- `packages/ui/src/globals.css` now declares `@source ".";` (adds `packages/ui/src` to the scan; auto-detection of app files still works — verified).

## Verification loop (regression)
```
curl -s "http://localhost:3000/_next/static/css/app/layout.css" | grep -c 'data-\\[state'
# expect >= 1
curl -s "http://localhost:3001/_next/static/css/app/layout.css" | grep -c 'data-\\[state'
# expect >= 1
```
No vitest seam exists for CSS generation; the curl probe above is the loop.