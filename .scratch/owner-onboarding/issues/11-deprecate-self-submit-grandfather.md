# 11 — Deprecate self-submit & grandfather

**What to build:** the old "any signed-up player submits a venue and gets promoted on approval" path closes. Only accepted-terms owners can create venues. Existing owners keep console access but see a "contact admin to set up your plan" banner until an admin provisions them. Venue submissions made before onboarding are still reviewed and processed.

**Blocked by:** 10 — Agreements & acceptance gate

**Acceptance criteria:**

- [ ] Venue creation is blocked for non-onboarded users (no accepted agreement)
- [ ] Existing owners keep access and see a "contact admin to set up your plan" banner
- [ ] Pre-onboarding pending venues still get reviewed
- [ ] The self-submit registration/promotion path is removed
- [ ] Existing owner accounts with no plan/agreement are visible to admins for provisioning