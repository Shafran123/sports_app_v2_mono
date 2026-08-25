# 07 — Widget embed route + allowlist enforcement

**What to build:** the no-chrome embeddable route (`myslot.lk/embed/<key>`) that venues put in an iframe. It renders the same booking flow as the branded page without chrome, validates the **parent origin** against the venue's allowlist (reject with a friendly "not authorized" surface otherwise), and sets frame/embedding headers (X-Frame-Options or CSP frame-ancestors) so the page is embeddable exactly where allowed. Works in the P0 cash flow end to end.

**Blocked by:** 02 (key + allowlist), 04 (flow), 03 (identity).

**Status:** ready-for-agent

- [ ] Route `myslot.lk/embed/<key>` serves the chrome-less booking flow
- [ ] Parent-origin check against the allowlist; unauthorized origins see a denial state
- [ ] Headers/CSP allow framing only for allowlisted origins
- [ ] Works with identity (03) and cash checkout (04) end to end in a host page
- [ ] Tests: iframe on allowed domain books; disallowed domain denied; direct navigation (no parent origin) defined behavior