# 14 — Forced password change fields lack a show/hide (eye) toggle

**Status:** completed

**What to fix:** the owner's forced password-change form shows "New password" and "Confirm password" as masked inputs with no way to reveal them. Typing a temporary password blind — especially the admin-generated one from the handoff email — makes the first-sign-in flow error-prone.

**Reproduction:** sign in as a fresh owner (`must_change_password = true`). The **Set a new password** card renders two `type="password"` inputs with no visibility toggle; there is no way to see what was typed in either field.

**Root cause:** `apps/admin/src/features/plan/plan-page.tsx:208` and `:212` — `<Input id="new-password" type="password" ...>` / `<Input id="confirm-password" type="password" ...>`. Neither input has a show/hide control.

**Fix direction:** add a reveal toggle (eye icon) to each password field that switches the input type between `password` and `text` and swaps the icon accordingly. Check whether `@myslot/ui` already ships a password input or an icon set to reuse before adding a new component; mirror whatever the admin app already uses for other masked fields (e.g. `apps/admin/src/features/admin-auth/login-form.tsx` if it has one).

**Acceptance criteria:**

- [ ] Each password field has a visible show/hide control that reveals and re-masks the value
- [ ] The toggle is keyboard-accessible and has an `aria-label` / tooltip ("Show password" / "Hide password")
- [ ] The reveal state is per-field (new vs confirm toggles independently)
- [ ] Validation, min-length (8), and match checks are unchanged
- [ ] The existing backend flow (`passwordChanged` clearing `must_change_password`) is untouched
## Comments

Fixed 2026-08-23. Swapped the two `<Input type="password">` fields in `PasswordChangeCard` for the existing `@myslot/ui` `PasswordInput` (eye/eye-off reveal toggle, `aria-label="Show password"`/`"Hide password"`, per-field state) — same component the login forms already use. Regression: `plan-page.test.tsx` ("offers a show/hide toggle on both forced password fields"). Note: do NOT pass `type` to `PasswordInput`; it owns the type and spreads props last.
