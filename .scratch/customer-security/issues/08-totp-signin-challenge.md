# 08 — TOTP sign-in challenge (Dedicated Site + widget iframe)

**What to build:** A Site Customer with a second factor enabled must complete a TOTP challenge (or redeem a backup code) after email+password or Google sign-in, before a session is issued — on both the Dedicated Site and inside the Booking Widget iframe. The widget challenges enrolled customers but never offers enrollment (that lives in the account panel).

**Blocked by:** 07 — TOTP backend, schema, backup codes, require-toggle, recovery

**Status:** completed

- [x] Dedicated Site: enrolled customer passes a TOTP/backup-code challenge before session issue
- [x] Widget iframe: enrolled customer passes the same challenge before session issue
- [x] Google sign-in path also challenges when enrolled
- [x] Wrong code / exhausted backup codes do not issue a session
- [x] Tests cover both surfaces and both sign-in paths
