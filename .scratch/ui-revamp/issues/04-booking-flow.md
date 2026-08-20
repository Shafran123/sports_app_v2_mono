# 04 — Booking flow: slots, checkout, confirmation

**What to build:** the checkout journey becomes as good as the reference. Slot picker chips with clear state legs, checkout summary card with countdown ring, PayHere redirect interstitial, and QR confirmation success screen — all on the dark identity with new motion.

**Blocked by:** 01 — Design system; 03 — Home, hero, and venue (slot picker lives there).

**Status:** ready-for-agent

- [ ] Checkout page: summary card (venue/court/time/price numerals in lemon), hold countdown (red under 60s), pay pill button, redirect state; error card for 409 with new styles
- [ ] `/bookings/[id]` polling screen + success card with QR and email note restyled
- [ ] `/bookings` history list restyled (status pills: confirmed/checked_in/completed/cancelled/no_show)
- [ ] Mobile-first layouts, loader skeletons; `npm run build` green