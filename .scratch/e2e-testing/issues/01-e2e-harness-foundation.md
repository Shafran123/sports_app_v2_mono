# 01 — E2E harness foundation

**What to build:** A Playwright test harness (top-level `e2e/`) that boots the real local stack — Express backend, Next user app, (and admin app for later suites) — against a fresh throwaway Postgres database per run, and makes every role's session reproducible: JWT token injection for platform roles, a seeded Site Customer with a live session, a live-site hostname fixture, and cash-only payment config. A first smoke spec proves the Dedicated Site home renders the seeded Demo Business and venues on `mysite.localhost`, and the platform host shows the marketplace-closed slate. Records the strategy as an ADR (token injection over real Firebase login, fresh DB per run, cash-only, e2e kept out of `pnpm test`).

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `pnpm e2e` creates a fresh `sports_e2e_<rand>` DB, runs migrations + seed, applies e2e fixtures, boots backend + user app, runs specs, and tears everything down.
- [ ] Platform tokens (owner/admin) are minted with `JWT_SECRET` under `NODE_ENV=test` and injected into the app via localStorage (`spots_token`).
- [ ] A seeded Site Customer with a live session row signs in the Dedicated Site (`site_customer_token`).
- [ ] `mysite.localhost` resolves the Dedicated Site chrome; the platform host shows the marketplace-closed slate.
- [ ] Smoke spec passes; `pnpm e2e:ui` opens Playwright's web UI.
- [ ] ADR 0048 documents the strategy.