# 01 — Private venue visibility flag

**What to build:** venues gain a public/private visibility flag. A private venue is invisible in every in-app surface — browse, search, venue detail (direct URL in the player app shows not-found), admin/console unaffected. Bookable only via widget and branded page. Flag is Admin-set at provisioning under ADR-0022 onboarding; migration defaults existing venues to public.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Migration adds visibility flag (default public) to venues
- [ ] Player-app browse/search/venue-detail queries exclude private venues
- [ ] Direct player-app URL to a private venue does not reveal it (no leak of existence)
- [ ] Admin console can set the flag at provisioning; owner console shows read-only state
- [ ] Tests: private venue absent from browse/search, not reachable by direct URL, still bookable via widget in later tickets