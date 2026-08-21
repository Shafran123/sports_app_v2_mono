# 18 — Admin venue control: suspend, ban, remove + audit log + resubmit

**Status:** ready-for-agent
**Depends on:** 15 (spec)

## What to build
- Admin venue actions beyond approve/reject:
  - **Suspend** — venue hidden + not bookable, reversible (unsuspend).
  - **Ban** — owner-account level; owner loses console access; all their venues unbookable. Permanent.
  - **Remove/archive** — soft-delete; data kept.
- Suspend/ban **stop new bookings but let existing confirmed bookings play out** (no auto-cancel).
- Reject → **"changes requested"** state; owner edits venue and resubmits.
- **Audit log** of every admin venue action (admin who, timestamp, action, reason). Store as `venue_audit` table.

## Acceptance
- [ ] Admin can suspend + unsuspend a venue; suspended venue disappears from explore and can't be booked
- [ ] Admin can ban an owner; owner's login is rejected (or console shows "account banned") and all their venues are unbookable
- [ ] Admin can archive a venue (soft-delete)
- [ ] Existing confirmed bookings still play out under suspend/ban
- [ ] Rejected venue shows "changes requested"; owner can edit and resubmit
- [ ] Every action is in the audit log with who/when/what/reason
- [ ] Availability engine respects suspend/ban (no new slots)

## Notes
- DB: `venues.status` currently `pending/approved/rejected` — add `suspended`, `banned`, `archived` (migration + check constraint). Ban may also need `users.status` (active/banned) or reuse a flag.
- Availability `getAvailability` filters `status='approved'` — add the new states.
- Auth guard on business routes must reject banned owners.
- Audit table: `venue_audit(id, venue_id, actor_id, action, reason, created_at)`.