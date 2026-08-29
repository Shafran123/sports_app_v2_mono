# 09 — TOTP enrollment UI + owner console require toggle

**What to build:** The Dedicated Site's Site Customer account panel gains a Second Factor section: enable with QR + backup codes shown once, disable, and regenerate backup codes. The owner console gains the per-Business "require 2FA" toggle that makes the factor mandatory for that Business's Site Customers.

**Blocked by:** 07 — TOTP backend, schema, backup codes, require-toggle, recovery

**Status:** completed

- [x] Account panel: enable via QR, backup codes shown once, disable, regenerate codes
- [x] Owner console: per-Business require-2FA toggle
- [x] Requiring 2FA surfaces a clear message to that Business's customers at sign-in
- [x] Tests cover enrollment flow and the toggle
