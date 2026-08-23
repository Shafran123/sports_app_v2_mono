# 04 — Admin app: brand surfaces + settable brand in Settings

**What to build:** the admin console adopts the new brand, and the "admin-configurable brand" promise becomes real with a Settings field.

- Wordmark (MySlot + green `.LK`): `components/shell/sidebar.tsx` (both lockups) and `features/admin-auth/login-form.tsx` ("MySlot.LK Console").
- Page metadata: `app/layout.tsx` "Spots Console" → server-side config read, fallback "MySlot.LK Console".
- `features/admin-console/events-manager.tsx`: verify the existing `brand_name` read falls back to `MySlot.LK` (not `Spots`).
- **Settings page** (`features/settings/settings-page.tsx`): add a Brand tab/field — text input, loads the current `brand_name` from `platformConfig`, saves via `admin.setConfigKey('brand_name', …)`, shows the same saved/error feedback as the Tax field. Server already accepts the key after ticket 01.
- Tests: settings-page fixture gains `brand_name: "MySlot.LK"`; new test that the brand field appears and round-trips.

**Blocked by:** 001, 002

**Status:** ready-for-human (implemented, code-level checks pass; deploy-level checks pending)

- [ ] Admin sidebar and login show MySlot + green `.LK` (and follow configured brand)
- [ ] Admin console tab reads "MySlot.LK Console" (or configured brand)
- [ ] Settings shows a Brand field; saving it updates the public config live and records an audit row
- [ ] No visible "Spots" remains in `apps/admin`
- [ ] `turbo run typecheck` / `turbo run test` pass for `apps/admin`