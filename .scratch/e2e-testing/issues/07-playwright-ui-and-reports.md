# 07 — Playwright UI explorer & reporting

**What to build:** The team-facing layer over the e2e suites: Playwright's web UI to explore and re-run individual specs, HTML + JSON report artifacts under `e2e/reports`, and run documentation (prerequisites, commands, what each suite covers) in the README.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] `pnpm e2e:ui` opens the Playwright UI and can re-run a single spec.
- [ ] HTML report and JSON results are written under `e2e/reports`.
- [ ] README documents `pnpm e2e`, `pnpm e2e:ui`, requirements, and coverage scope.