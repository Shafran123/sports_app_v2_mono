# 07 — Admin read-only payment summary

**What to build:** admin view of each Business's payment configuration and collections — read-only, never secrets, no edits (Q29/Q33).

- Per-Business row/section: Cash enabled?, PayHere enabled?, PayHere `state` badge (per 03), `app_last4`, last configured date.
- **Collection sums**: PayHere-paid totals per Business by period (e.g. 7/30/90 days, matching the existing reports time-series) — informational only, since the money sits in the owner's PayHere account, not the platform's. Cash collected totals likewise.
- Read-only by design: admin cannot toggle methods, cannot see/edit secrets, cannot trigger refunds from this view (refunds stay in 08 + existing admin refund screen for platform/legacy payments).
- Admin route + nav entry; reuse the reports money-helper for period boundaries (Asia/Colombo).

**Blocked by:** 03, 05

**Status:** ready-for-agent

- [ ] Admin view with config state + collection sums per Business
- [ ] No secret material anywhere in the view or its API response
- [ ] Period sums correct per the reports helper; tests for the sums endpoint