# 01 — Scaffold the rebuild monorepo

**What to build:** the new home for both frontends exists: one repo with two Next.js apps (player app and operator/admin dashboard app) sharing typed packages, on the new light-premium identity, both apps building green.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Repo root is a git repo with pnpm workspaces + Turborepo; `apps/user` (player) and `apps/admin` (operator/dashboard) both run with `pnpm dev` and build with `pnpm build`
- [ ] TypeScript strict in both apps and all packages; ESLint + Prettier wired; `pnpm lint` green
- [ ] Tailwind v4 + shadcn/ui initialized; the light-premium design tokens (paper base, ink text, court-green primary, blue accent, Plus Jakarta Sans body + display headline font) live as CSS variables in a shared theme
- [ ] Vitest + Testing Library configured; a minimal suite runs green
- [ ] ADR-0005 (light-premium identity supersedes ADR-0004) and ADR-0006 (one repo, two apps, shared packages) recorded in the docs