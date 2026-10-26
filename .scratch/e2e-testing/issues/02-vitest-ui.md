# 02 — Vitest UI for the frontend suites

**What to build:** Interactive Vitest UI over the existing frontend unit/component suites. A developer runs `pnpm test:ui` and gets the browser UI to watch, filter, and re-run tests in apps/user, apps/admin, apps/landing, packages/ui and packages/auth. The backend (`sp_be`) suite is excluded — it is sequential and slow by design.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `@vitest/ui` added to the frontend workspaces (user, admin, landing, ui, auth).
- [ ] Root `pnpm test:ui` launches the UI for the frontend suites; `pnpm test` is unchanged.
- [ ] The backend suite is untouched.