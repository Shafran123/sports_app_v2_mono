# 05 — Widget "Your bookings" + in-widget cancel

**What to build:** The widget stops being terminal after the success screen. A "Your bookings" entry in the widget header (re-prompting phone OTP when there is no session) opens the signed-in Player's own upcoming bookings for this Venue: date, court, time, total, and a QR affordance to re-view the check-in QR. Each future booking offers a **Cancel** action that confirms first, fires the standard player-cancelled notifications, and respects the Venue's Cancel Cutoff — past the cutoff the action is disabled with "contact the venue" messaging. Cash widget bookings carry no refund.

**Blocked by:** 02 — Venue cancel-cutoff setting

**Status:** ready-for-agent

- [ ] "Your bookings" appears in the widget header and opens a list of the signed-in Player's upcoming bookings for the widget's Venue
- [ ] With no session, opening it prompts phone OTP first; the list is scoped to the signed-in Player only
- [ ] Each listing shows date, court, time, total, and a re-viewable QR when the booking carries one
- [ ] Cancel is available only within the Venue's Cancel Cutoff; past it, the action is disabled with "contact the venue" messaging
- [ ] Cancelling asks for confirmation, then succeeds and disappears from the list, firing the same player-cancelled notifications as the app
- [ ] Success-screen copy no longer implies the widget is the only place to see the booking
