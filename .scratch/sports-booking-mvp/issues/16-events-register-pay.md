# 16 — Events register/pay

**What to build:** players can register for an event, pay online, and receive a QR ticket; capacity is enforced server-side (no over-registration); when the organizer cancels, all registrants are refunded automatically.

**Blocked by:** 10 — Payment webhooks + refunds; 15 — Events create/manage.

**Status:** ready-for-agent

- [ ] Register flow reuses the payment path (PayHere sandbox) with the event price
- [ ] Successful registration produces a ticket with QR and an email
- [ ] Capacity is enforced transactionally — two concurrent registrations cannot exceed capacity; full events show as full
- [ ] Organizer/admin cancellation refunds every registrant and notifies them
- [ ] Player sees registrations in their history/profile

## Comments
Completed: 2026-08-19
