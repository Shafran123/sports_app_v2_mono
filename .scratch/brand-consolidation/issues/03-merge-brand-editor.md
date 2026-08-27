# 03 — Merge the two brand cards into one Business Brand editor

**What to build:** The owner's *Widget & site* console shows one "Business Brand" editor instead of two separate cards. All brand fields live in clearly labelled sections — identity (name, tagline, about), colors, logo, site banner, contact, social links, site policies — saved through one button. No field appears twice and nothing the owner can already set is lost.

**Blocked by:** 01 — Retire `headline`, migrate into `about`

**Status:** ready-for-agent

- [x] One card replaces the two, with the sections above; single save path via the existing business update endpoint
- [x] No duplicated or ambiguous fields remain in the editor; the retired field is absent
- [x] Owner can set name, colors, logo, tagline, about, banner, contact, social links, and policies from the one editor
- [x] Admin page widget tests cover one-card render, section presence, and the single save round-trip
