# 14 — Notifications (in-app + email + push)

**What to build:** booking lifecycle events (confirmed, cancelled, 24h/2h reminders, venue approval, event cancelled) create notification rows shown in a bell-icon list with read state, and are delivered by email (Resend) and FCM push.

**Blocked by:** 09 — Booking flow (hold → pay → QR).

**Status:** ready-for-agent

- [ ] Notification rows are created on booking confirmed, booking cancelled, and reminder events
- [ ] Bell icon + notifications page lists them with unread/read state, newest first
- [ ] Emails sent for confirmed, cancelled, and reminders (Resend, real templates)
- [ ] FCM push delivered for the same events (pre-prod device)
- [ ] Reminders (24h and 2h) fire on schedule via a job runner

## Comments
Completed: 2026-08-19
