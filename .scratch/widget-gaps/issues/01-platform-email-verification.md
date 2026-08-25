# 01 — Platform email verification

**What to build:** A Player can add or change an email address on their account and prove it belongs to them by entering a 6-digit code emailed by the platform — the same mental model as the existing SMS OTP. Verified status is stored on the Player (a new "email verified" marker), survives until the address is changed, and is read back by the profile API so clients can show a verified badge. Fresh widget Players can also set name and email through the same profile surface.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Player can add/update name and email on their profile; the email address is validated format-wise
- [ ] Submitting an email sends a 6-digit code to the inbox; the code expires after 10 minutes, allows a bounded number of attempts, and supports resend with a cooldown
- [ ] Entering the correct code marks the email verified on the Player; the marker persists in the database
- [ ] Changing the email address clears the verified marker until the new address is re-verified
- [ ] The Player profile API returns the email plus its verified state; no player-facing surface or API leaks the code itself
- [ ] Email templates use the platform brand and the standard transactional email path
