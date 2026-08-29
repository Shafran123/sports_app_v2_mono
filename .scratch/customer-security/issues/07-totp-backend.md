# 07 — TOTP backend, schema, backup codes, require-toggle, recovery

**What to build:** The Site Customer second-factor system, server-side. A Site Customer can enable a TOTP factor (secret generated, encrypted at rest with a server key) and later disable it. Sign-in verification (email+password and Google paths) is done server-side in the backend before a session is issued. Ten single-use backup codes are shown once at enrollment and are regenerable. A per-Business "require 2FA" toggle makes the factor mandatory for that Business's Site Customers. Recovery: a Venue Owner can reset the factor for their own Business's customers, and an Admin as backstop; any reset also revokes all of that customer's active sessions. Schema migration adds the required columns/tables.

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] Migration adds TOTP secret (encrypted at rest), enabled flag, backup-code storage, per-Business require toggle
- [x] Enable/disable endpoints; secret encrypted with server key, never returned in plaintext
- [x] Server-side verification at sign-in for email+password and Google paths
- [x] Ten single-use backup codes, shown once, regenerable, each consumed by one use
- [x] Venue Owner resets their own customers' factor; Admin as backstop
- [x] Resetting a factor revokes all of that customer's active sessions
- [x] Per-Business require toggle enforced server-side at sign-in
- [x] Tests cover enrollment, verify, backup codes, require-toggle, and recovery-with-revocation
