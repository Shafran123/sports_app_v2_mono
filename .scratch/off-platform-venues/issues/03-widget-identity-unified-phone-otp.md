# 03 — Widget identity: unified phone OTP, auto-create player

**What to build:** the widget's identity step. One "enter phone → OTP → book" flow. Phone with an existing Player account: OTP signs that account in. Fresh phone: auto-create a Player server-side, phone-verify, and proceed — no app download required. The identity step is always enforced in the widget regardless of the platform's `phone_verification_required` flag. "Sign in with MySlot.LK" later works naturally because the buyer is already a Player.

**Blocked by:** 02 (needs venue context to scope the widget).

**Status:** ready-for-agent

- [ ] Widget POST /verify-phone + /verify-otp scoped to an embed key
- [ ] Existing phone → sign in to that Player account; fresh phone → account auto-created and verified
- [ ] OTP copy/machinery reused from phone sign-in (SMSGo); flag-independent inside the widget
- [ ] Session/hold carry through the widget to checkout
- [ ] Tests: fresh phone creates Player + verifies; existing phone signs in; wrong OTP rejected; account reuse keeps history