# 02 — Widget embed key + domain allowlist

**What to build:** per-venue widget provisioning. Each venue gets a stable public embed key (identifies the venue, not a secret) and an owner-managed domain allowlist. Backend: generate the key at provisioning, CRUD allowlist domains, validate a parent origin against the allowlist (origin check on the embeddable route, not the iframe's own URL). Owner-facing management is ticket 08; here only the data model + validation endpoint.

**Blocked by:** None — can start immediately (pairs with 01).

**Status:** ready-for-agent

- [ ] Migration: `widget_key` + `allowed_domains` (array or child table) per venue, unique key
- [ ] Backend generates a key for every venue; admin can regenerate
- [ ] Domain allowlist CRUD endpoint (validated hostnames; wildcard policy decided: subdomains or exact)
- [ ] Origin-validation helper: given an embed request with parent origin, allow/deny
- [ ] Tests: key uniqueness, regeneration, origin matching, empty allowlist = embed disabled