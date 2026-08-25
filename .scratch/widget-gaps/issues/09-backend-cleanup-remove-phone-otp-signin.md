# 09 — Backend cleanup: remove phone-OTP sign-in endpoints and auto-create logic

**What to build:** The phone-OTP identity path dies. Remove the public widget phone-OTP endpoints (`/public/widget/:key/phone/send|confirm` and the keyless branded-page variants) and their auto-create-Player logic (`widgetController` phone confirm), plus the app's authenticated phone-OTP sign-in remains only as verified-phone attribute OTP (kept — that is the Verified Phone challenge). The widget and app then run entirely on the standard email/Google Player stack.

**Blocked by:** 07, 08

**Status:** ready-for-agent

- [ ] Public widget phone-OTP endpoints (keyed and keyless) are removed
- [ ] The auto-create-Player-on-phone-confirm logic is removed; no code path creates a phone-only Player
- [ ] The widget client no longer calls any removed endpoint (phoneSend/phoneConfirm gone from the widget API client)
- [ ] The authenticated verified-phone OTP endpoints remain (they power the Verified Phone challenge)
- [ ] No existing test references the removed endpoints; updated suites pass