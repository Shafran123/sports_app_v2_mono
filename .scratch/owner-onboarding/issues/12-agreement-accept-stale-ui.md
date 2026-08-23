# 12 — Agreement acceptance does not clear the pending card (UI stays on "I accept")

**Status:** completed

**What to fix:** after a fresh owner accepts the agreement, the "Plan & agreement" page still renders the amber "Pending your acceptance" card with the accept/decline buttons — as if the acceptance never registered.

**Reproduction:**

1. Sign in as a fresh owner (temporary password, `must_change_password = true`, agreement `pending`).
2. Open **Plan & agreement**, click "I accept the agreement".
3. The mutation succeeds (backend sets status `accepted`, `onboarding_state = accepted`), queries are invalidated and refetched — but the card remains, still labelled pending, accept button still enabled.

**Root cause:** `apps/admin/src/features/plan/plan-page.tsx:62`

```ts
const pendingAgreement = data.agreements.find((a) => a.status === "pending") ?? current;
```

The `?? current` fallback is wrong. `getCurrentAgreement` (`sp_be/controller/ownersController.js:408`) returns "latest pending, else latest overall" — so after acceptance `current` is the just-accepted agreement, the `.find(...)` is `undefined`, and `pendingAgreement` silently falls back to an already-accepted agreement. The render guard at line 94 only checks `pendingAgreement` truthiness, not `.status`, so the card never unmounts.

**Fix direction:** only treat the agreement as pending when `status === "pending"` (drop the `?? current` fallback, or gate rendering on `pendingAgreement.status === "pending"`). Verify the `currentAgreement` query is only used as a fallback when no pending row exists.

**Acceptance criteria:**

- [ ] After accepting, the "Pending your acceptance" card disappears and accept/decline are no longer offered
- [ ] An accepted agreement shows in Agreement history with its accepted date, not as pending
- [ ] A genuinely pending agreement (fresh issue, renewal) still renders the accept/decline card
- [ ] Declining still blocks the console and shows the card
- [ ] Regression: existing ownerOnboarding backend tests still pass (`sp_be/test/ownerOnboarding.test.js`)
## Comments

Fixed 2026-08-23. Root cause: the `?? current` fallback in `plan-page.tsx` fell back to the just-accepted agreement from the `currentAgreement` query (which returns "latest pending, else latest overall"), so the accept/decline card never unmounted. Removed the `currentAgreement` query entirely; the pending card is now derived solely from `owner-onboarding/plan` (`data.agreements.find(a => a.status === "pending")`) and accept/decline target that agreement's id. Regression: `apps/admin/src/features/plan/plan-page.test.tsx` — "clears the pending acceptance card once accepted" + "does not offer the acceptance card when already accepted". All 17 admin widget tests + typecheck pass.
