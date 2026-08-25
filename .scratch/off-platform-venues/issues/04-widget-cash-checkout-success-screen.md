# 04 — Widget cash checkout + success screen

**What to build:** the widget's P0 checkout, cash-only. Same checkout/hold/QR/cash invariants as the player app, skinned for the widget. The success screen (QR + confirmation + "pay at the venue on arrival") is the terminal step that online checkout will later return to — build it as that contract now, with no gateway code. Owner records the Cash Payment at check-in (existing flow).

**Blocked by:** 03.

**Status:** ready-for-agent

- [ ] Widget checkout offers cash-at-venue only; no dead online button in P0
- [ ] Same Hold/expiry/booking-creation invariants as the player app
- [ ] Success screen shows QR + booking summary + pay-at-venue note
- [ ] Success screen structured as the future online-return target (route/state that a gateway callback can land on)
- [ ] Tests: hold released on expiry; booking created with cash method; success screen renders QR for a fresh widget player