# 03 — Landing sections: hero, how-it-works, features with screenshot frames, trial band

**What to build:** the visible page body — the hero that sells the 3-month offer, the 3-step how-it-works strip, the six feature sections each with a placeholder screenshot in a device frame, and the repeat trial band.

- **Hero** (`components/hero.tsx`): headline + sub from `copy.ts`, primary CTA **"Start your 3-month free trial"** scrolling to `#inquire`, secondary CTA ("See how it works" → `#how-it-works`), and a phone-frame mockup on the right (desktop) / below (mobile).
- **How it works** (`components/how-it-works.tsx`): three numbered steps — submit the form → we set up your venue and plan → you're live and taking bookings.
- **Feature sections** (`components/features/*`): six alternating sections, each reading heading, body, and bullets from `copy.ts` and its screenshot from `screenshots.ts`:
  1. **Your courts, bookable in real time** (browser frame — court list + slot calendar)
  2. **Front-desk & walk-in check-ins** (phone frame — QR check-in / quick book)
  3. **Payments your way** (browser frame — PayHere, cash, tax split, bills)
  4. **Events & registrations** (phone frame — event listing + register)
  5. **Know what's happening** (browser frame — owner dashboard)
  6. **For players** (phone frame — explore venues) with a "Explore venues" button linking out to the player app.
- **DeviceFrame** (`components/device-frame.tsx`): renders a phone or browser chrome around either a CSS-composed mockup (default) or a real screenshot once `src` is added to the `screenshots.ts` entry. Mockups are pure Tailwind — no new deps, no images.
- **Trial band** (`components/trial-band.tsx`): "List your venue free for 3 months" + CTA → `#inquire`, between the features and the form.
- **Motion**: section entrances use the `@myslot/ui` fade-up / word-roll keyframes.

**Blocked by:** 02

**Status:** ready-for-human (implemented, code-level checks pass; deploy-level checks pending)

- [x] All six feature sections render their copy and a placeholder device-frame screenshot
- [x] Hero + trial band CTAs scroll to `#inquire`; player-section button links to the product app
- [x] Every string comes from `copy.ts`; every screenshot slot comes from `screenshots.ts`
- [x] `turbo run build` and `turbo run typecheck` green