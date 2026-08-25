# 05 — QR + confirmation by SMS/email for widget players

**What to build:** widget buyers may never open the player app, so the QR and booking confirmation must reach them off-platform. On widget booking: send the confirmation + QR by SMS (verified phone) and email (if present) and show both on the widget success screen. Same QR token as always; delivery path is what's new. Existing player-app and owner-facing flows unchanged.

**Blocked by:** 03 (player creation), 04 (booking exists).

**Status:** ready-for-agent

- [ ] Widget booking triggers transactional SMS (booking confirmation + QR, per SMSGo templates)
- [ ] Email confirmation + QR when a verified email exists on the Player
- [ ] Success screen independently shows the same QR (no reliance on SMS delivery)
- [ ] Templates reuse existing confirmation/reminder copy with widget-appropriate framing
- [ ] Tests: widget booking emits SMS + email; no email field → SMS only; QR matches the booking token