# 02 — Venue cancel-cutoff setting

**What to build:** Each Venue has a Cancel Cutoff — a setting, in hours before the booking start, by which a Player may still self-cancel (default 2 hours). A Venue Owner sets it in the venue's settings; the cancellation engine enforces it: self-service cancellation is rejected once the booking start is closer than the cutoff, with a clear "contact the venue" message. Cash widget bookings respect the same rule. The global cancellation tiers continue to govern refund percentages for online-paid bookings only.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Venue carries a Cancel Cutoff (hours before start), defaulting to 2, editable by the Venue Owner in venue settings
- [ ] Player-initiated cancellation is allowed only while the current time is at least the cutoff before the booking start
- [ ] Past the cutoff, self-cancel fails with an actionable "contact the venue" error; venue-owner/admin cancellation is unaffected
- [ ] Refund percentages still come from the platform cancellation tiers for online-paid bookings; cash bookings remain refund-less
- [ ] Existing behavior for bookings with no cutoff set matches the default (2 hours)
