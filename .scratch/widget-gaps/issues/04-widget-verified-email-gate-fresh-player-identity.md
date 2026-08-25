# 04 — Widget verified-email gate + fresh-player identity

**What to build:** The widget's identity step collects everything a booking needs. A fresh Player (phone OTP returns "new account") is asked for their **name** and **email** as part of the same step. Every widget booking — not just fresh users — requires a Verified Email: if the signed-in Player has no verified email on file, the step collects/verifies one via email OTP before the picker unlocks. Once verified, the widget always shows who is booking — "Booking as **{name or phone}**" above the confirm button with a **Switch** action that signs out and returns to the identity step.

**Blocked by:** 01 — Platform email verification

**Status:** ready-for-agent

- [ ] Fresh widget Players enter name and email after phone OTP; both persist on their Player account
- [ ] Any widget booking without a Verified Email on the account is gated at the identity step with an inline email-OTP flow; email verification completes without leaving the widget
- [ ] Returning Players with verified phone + verified email skip the step entirely
- [ ] The picker/checkout is unreachable while phone or email is unverified
- [ ] A "Booking as {name or phone}" indicator sits above the confirm action on the pick step; "Switch" signs out and shows the identity step again
- [ ] The checkout carries the Player's identity; the booking snapshots the verified name/email/phone
