# 06 — Owner Payments page (console)

**What to build:** the owner console's **Payments** page — toggles, credential entry, connected badge, remove keys. One page for everything (Q11/Q36). Sits alongside *Booking settings* in the shell nav.

- Two method cards: **Cash** (toggle only) and **PayHere** (toggle + credential form).
- PayHere credential form: merchant ID, merchant secret, app ID, app secret. Secrets masked, never echoed back (server returns `configured` + `app_last4` only). Save validates the app pair via 03; on success, badge shows **Configured** (or **Awaiting first transaction** until the first paid booking lands — merchant secret unprovable until then).
- State badge per 03's `state`: `not_configured` → "Not configured", `invalid_app_credentials` → "Invalid app credentials — re-enter", `awaiting_first_transaction` → "Connected — awaiting first payment", `configured` → "Connected".
- **Remove keys** button (confirm dialog, states what happens to outstanding refunds — escalates to admin). Disabling PayHere keeps keys; separate actions, distinct labels.
- At-least-one-method guard surfaced in UI: toggling the last method off is blocked with a message.
- Wire to `packages/api` client methods from 03.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Payments page in owner shell nav; both method cards render current state from API
- [ ] Credential save with validation error states; masked display; remove-keys confirm
- [ ] Guard UX for last-method-off; disable-keeps-keys vs remove-keys distinction
- [ ] Widget tests for toggle/guard/credential-save flows