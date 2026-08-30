# 03 — Consent on dedicated sites

**What to build:** Every Dedicated Site shows the same consent banner and gating as the landing app. Because Dedicated Sites run on per-Business hostnames, the per-origin local storage record means each site holds its own visitor choice — a visitor who accepted on the marketplace must choose again on a Business's site. The admin and owner consoles are deliberately out of scope: no consent banner, no analytics.

**Blocked by:** 01 — Consent banner + gating on landing app (reuses the shared consent component)

**Status:** ready-for-agent

- [x] Banner renders on each Dedicated Site, blocking until choice
- [x] Per-origin choice means each dedicated-site hostname holds its own record
- [x] Withdraw/change path present on all surfaces
- [x] Tests cover per-origin separation and version bump on dedicated sites
- [x] No consent banner on the admin or owner consoles
