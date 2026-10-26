# 08 — Admin console smoke (P2)

**What to build:** Smoke coverage of the admin surface with a token-injected admin: dashboard, bookings, the Venue approvals list, Owners, and Settings (flags/tax). Deliberately thinner than the owner/user suites — admin is P2.

**Blocked by:** 05 — reuses the established token-injection and storage-state patterns.

**Status:** ready-for-agent

- [ ] Token-injected admin lands on the dashboard.
- [ ] The Venue approvals list renders the seeded venues.
- [ ] Settings renders the feature flags and tax surfaces.
- [ ] Runs but never gates; documented as P2 coverage.