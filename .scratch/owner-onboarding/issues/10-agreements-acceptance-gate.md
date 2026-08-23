# 10 — Agreements & acceptance gate

**What to build:** the owner's commercial contract and the gate that enforces it. An agreement template with per-owner placeholders (owner, business, plan, dates, bank account, terms) is drafted when an owner is created and sent as a PDF in the email. On first sign-in the owner must accept the current agreement full-screen before the console unlocks; then they are forced to change their temporary password. A "Plan & Agreement" sidebar page shows the current plan, bank details, the agreement + PDF, renewal history, and an accept button. Renewal drafts a fresh agreement and requires a fresh acceptance.

**Blocked by:** 8 — Create owner account, 9 — Plan catalog & registry

**Acceptance:**

- [ ] First sign-in forces a full-screen agreement acceptance before any console access
- [ ] Accepting triggers a forced password change; declining blocks the console
- [ ] "Plan & Agreement" sidebar page shows plan, bank details, agreement + PDF, renewal history, accept button
- [ ] Renewal drafts a new agreement, emails it, and requires a fresh acceptance
- [ ] No console access and no venue creation until accepted