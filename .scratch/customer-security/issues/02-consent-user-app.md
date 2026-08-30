# 02 — Consent on marketplace user app

**What to build:** The marketplace user app shows the same consent banner and gating as the landing app (shared component). Analytics (GA4) is added to the user app for the first time, and initializes only after an explicit Accept. The choice is recorded per origin in local storage with the same versioning.

**Blocked by:** 01 — Consent banner + gating on landing app (reuses the shared consent component/record format)

**Status:** ready-for-agent

- [x] Banner renders on the user app on first visit, blocking until choice
- [x] GA4 added to the user app, initializing only after Accept
- [x] Same per-origin local storage record + versioning as 01
- [x] Withdraw/change path present
- [x] Tests cover accept, reject, withdraw, version bump on the user app
