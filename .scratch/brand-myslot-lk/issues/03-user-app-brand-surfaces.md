# 03 — User app: config-driven MySlot.LK brand surfaces

**What to build:** every user-facing surface in `apps/user` reads the brand from public config (fallback `MySlot.LK`), with the new wordmark lockup, and the word "Spots" disappears from UI copy.

- **Wordmark lockup** (config-driven brand + green `.LK`): "MySlot" in ink, `.` and `.LK` in `text-primary`. Surfaces: `components/shell/player-nav.tsx`, `components/shell/footer.tsx` (wordmark + copyright), `features/auth/login-form.tsx`, `features/auth/register-form.tsx`.
- **Page metadata**: `app/layout.tsx` title "Spots — Find Your Game" → server-side read of `brand_name` (fallback `MySlot.LK — Find Your Game`); async metadata fetch of the public config.
- **Copy**: `features/home/venues-near-you.tsx` "as they join Spots" → "as they join {brand}".
- **Events surfaces** already read `brand_name` — verify their fallback string updates from `"Spots"` to `"MySlot.LK"` (`event-detail-page.tsx`, `events-list-page.tsx`).
- **Tests**: update fixtures asserting `brand_name: "Spots"` and hardcoded wordmarks (`player-nav.test.tsx`, `login-form.test.tsx`, `register-form.test.tsx`, `checkout-page.test.tsx`). Add coverage that nav/footer render the configured brand from a mocked public config, and fall back to `MySlot.LK`.

**Blocked by:** 01, 02

**Status:** ready-for-human (implemented, code-level checks pass; deploy-level checks pending)

- [ ] No visible "Spots" string remains in the user app (excluding tests that intentionally assert fallback behavior)
- [ ] Nav, footer, login, register show "MySlot" + green `.LK` and follow a configured `brand_name`
- [ ] Browser tab reads "MySlot.LK — Find Your Game" (or configured brand)
- [ ] `turbo run typecheck` / `turbo run test` pass for `apps/user`