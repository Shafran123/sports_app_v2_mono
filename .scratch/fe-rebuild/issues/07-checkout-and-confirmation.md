# 07 — Checkout, PayHere redirect, and confirmation

**What to build:** the money path works end to end. A Player goes from selected slots to a held, paid booking with a QR confirmation — including the slot-race recovery and hold-expiry states.

**Blocked by:** 06 — Venue detail and slot picker.

**Status:** ready-for-agent

- [ ] Checkout: summary card (venue / court / date / time / duration / total in Rs), hold countdown that turns red under 60s, PayHere redirect interstitial
- [ ] 409 slot-taken: automatically refresh availability and offer alternative slots in a picker instead of a dead error
- [ ] Hold expiry: a clear "slots released" state with a return-to-venue action
- [ ] Confirmation: polling the booking until paid → success card with QR and email note; timed-out and cancelled states
- [ ] Mobile-first layouts; loader skeletons; build green