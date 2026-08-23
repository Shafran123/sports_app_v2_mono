# 02 — Owner sets Venue Tax

**What to build:** the owner manages their own per-venue tax rate. The venue settings UI gains a Venue Tax control with a live readout (at a 100 LKR price, "you keep X, tax to platform Y, tax to you Z"), backed by an API on the venue. The admin sees the Venue Tax read-only in venue detail and reports.

**Blocked by:** 01 — Inclusive tax engine

**Status:** ready-for-agent

- [ ] Owner can set/change `venue_tax_rate` per venue from the venue's settings
- [ ] The rate is validated (finite, 0–100) and persisted with an audit trail
- [ ] The owner sees the live "keep vs tax" split while setting the rate
- [ ] Admin venue detail shows the Venue Tax read-only
- [ ] Platform Tax remains admin-only, unchanged