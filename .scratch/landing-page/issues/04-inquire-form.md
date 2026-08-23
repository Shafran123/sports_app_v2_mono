# 04 — Inquiry form wired to the Owner Lead backend

**What to build:** the `#inquire` section — an Owner Lead inquiry form that posts to the existing backend through the same client and proxy the app already uses, with validation and a success state.

- **Form** (`components/inquire-form.tsx`): fields per the Owner Lead shape — name (required), email (required), phone, venue name, city, notes. Client-side validation mirrors `become-owner-page.tsx` (name + email required, the rest optional).
- **Submission**: `useMutation` calling `leads.submit` from `@myslot/api` — the identical call `apps/user/src/features/leads/become-owner-page.tsx:13` makes — which posts `POST /api/v1/public/leads` through the `next.config.mjs` rewrite to the backend.
- **States**: idle → submitting (button disabled + "Submitting…") → success (replaces the form with a thank-you panel: "Thank you — we'll be in touch", consistent with the existing lead form) / error (red banner via `toApiFailure`, same shape as the app).
- **Copy**: all labels, placeholders, CTA, and success text come from `copy.ts`.
- **No auth**: this is the public leads endpoint — no token, no client changes.

**Blocked by:** 03

**Status:** ready-for-human (implemented, code-level checks pass; deploy-level checks pending)

- [ ] Submitting a valid form hits `POST /api/v1/public/leads` and returns the success card (covered by vitest; live-fire needs the dev backend)
- [x] An invalid form shows the existing validation behaviour and does not submit
- [x] Backend-down / API error shows the red banner from `toApiFailure`
- [ ] A submitted lead appears in the admin console's Leads view (triaged as new) — needs live backend
- [x] `turbo run build` and `turbo run typecheck` green