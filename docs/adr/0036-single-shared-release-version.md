# 0036 — Single shared release version across all surfaces

- **Status:** accepted
- **Date:** 2026-08-27

## Context

The monorepo ships three Next.js surfaces — `apps/user` (marketplace **and** Dedicated Sites, host-based routing per ADR-0029), `apps/admin`, and `apps/landing` — plus the Express backend `sp_be`. All packages sat at `0.1.0` with no tags, no changelogs, and no release tooling, so "which build is in prod / which build has the bug" was unanswerable. We want a visible version number and maintainable releases without ceremony.

## Decision

- **One shared SemVer, source of truth is the root `package.json` `version`** (now `1.0.0`, tagged `v1.0.0`). The three apps do not carry independent release versions; the app-level `package.json` `version` fields are vestigial and not authoritative.
- **Injected at build time.** Each app's `next.config.mjs` reads the root `version` and exposes it as `NEXT_PUBLIC_APP_VERSION`; bumping one field re-stamps all surfaces. `turbo.json` adds `package.json` to `globalDependencies` so the cache invalidates on a version bump.
- **Visibility per surface.** Admin: sidebar footer + login screen. Marketplace: low-key `vX.Y.Z` in the footer. Dedicated Site and Landing: **never shown** to visitors (white-labeled / marketing); staff confirm any surface's build via a plain-text `/version.txt` route handler (a `_`-prefixed dir would be skipped as a private folder, so it's a `.txt` probe like `robots.txt`), sitting outside the shell layouts so it answers identically on site hosts too.
- **Release flow.** SemVer: patch bump per push to `main` (deploys are push-to-main on Vercel/Railway), minor for features, major for breaking. Tag every release `vX.Y.Z` on `main`. No release tooling and no `CHANGELOG.md` — commit history is the changelog.

## Trade-offs

- **Single shared version vs per-app versions**: one number to answer "what's in prod" and zero coordination cost, at the price of not knowing which surface changed in a given release (answerable via the git tag's diff).
- **Build-time env injection vs runtime constant**: a build-time stamp can't drift per environment and survives caching (root package.json is a global turbo dependency), at the cost of a rebuild to change it.
- **Hidden on white-labeled surfaces** vs uniform display: the site must never carry the platform's build label for visitors; staff get the same answer through `/version.txt`.
- **A `_`-prefixed path was rejected**: Next.js treats `__*` folders as private and silently skips them, so the probe lives at `/version.txt`.

## Consequences

- `CONTEXT.md` is untouched — no new domain terms (the version is an implementation artifact, not domain vocabulary).
- Release procedure for staff: bump root `version` → commit → tag `vX.Y.Z` → push (deploys all three surfaces).
- `NEXT_PUBLIC_APP_VERSION` is a public constant baked into every bundle — it is a build identity, not a secret; `/version.txt` intentionally requires no auth.