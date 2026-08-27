# 01 — Retire `headline`, migrate into `about`

**What to build:** The `headline` brand field disappears; any existing Site-brand headline content is preserved in the owner's About text. The owner edits only a short tagline and a longer About description, and the site home renders the same description as before for every Business.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [x] One-time data migration copies `headline` into `about` where `about` is unset; when both are set, `about` wins
- [x] `headline` removed from the brand schema and the backend brand validator
- [x] Site home description fallback reads `about || tagline` with no reference to `headline`
- [x] Backend and site tests updated; no `headline` references remain in code or tests
