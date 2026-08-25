# 06 — Player app email-verification surface

**What to build:** In the player app's profile, a Player can add, change, and verify an email address with the same email-OTP flow, and sees a verified badge once done. Verification is optional in the app — no booking gate — but prompts nudge players to verify so confirmation and reminder emails (including QR emails) reach their inbox.

**Blocked by:** 01 — Platform email verification

**Status:** ready-for-agent

- [ ] Profile shows the current email and verified state, with add/change/verify actions
- [ ] Adding or changing an email starts the OTP flow; verification persists on the account
- [ ] Changing an email clears verification until re-verified, matching platform semantics
- [ ] Soft, dismissible prompts invite verification ("verify to get confirmations by email"); no booking or app feature is blocked on it
- [ ] Verified state is read from the same profile API as ticket 01, so app and widget agree on it
