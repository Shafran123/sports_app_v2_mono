# 03 — Test harness

**What to build:** the backend has a working test setup — one command runs integration tests against an isolated Supabase dev project with per-test isolation — so later tickets can ship their booking/payment tests with the feature.

**Blocked by:** 02 — Supabase schema + seed.

**Status:** ready-for-agent

- [ ] Vitest + Supertest wired with npm scripts; `npm test` runs the suite
- [ ] Tests point at an isolated Supabase dev project via env vars (never the shared dev data)
- [ ] A documented helper truncates/re-seeds required tables between tests
- [ ] One example integration test (e.g. venue list endpoint) passes end-to-end against Postgres

## Comments
Completed: 2026-08-19
