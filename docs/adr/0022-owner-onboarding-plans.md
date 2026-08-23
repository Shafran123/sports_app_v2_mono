# 0022 — Owner onboarding: admin-provisioned accounts, plans, and agreements

- **Status:** accepted
- **Date:** 2026-08-23

## Context

Today there is no curated owner onboarding. Any signed-in user can submit a Venue and be promoted to `venue_owner` on approval; the backend never creates accounts (signup is client-side Firebase), and there is no Plan, Agreement, or Lead concept anywhere. The owner wants: a public lead form, an admin leads queue, admin-created owner accounts with a Plan (template catalog: term + price, zero = free) and a drafted Agreement, credentials emailed to the owner, and a first-login agreement-acceptance gate before console use.

## Decision

- **Owner accounts are always provisioned by the Admin** (directly or by converting a Lead). The backend creates the Firebase user with a temporary password, sets role `venue_owner`, attaches an Owner Plan instance (start + end from the template), and drafts an Owner Agreement.
- **Owner account email is unique and never reused from an existing Player account** — a Lead's email that collides with an existing account forces a different email for the owner; the player account is never mutated. (Firebase forbids two accounts on one email.)
- **First sign-in:** the Owner must accept the current Owner Agreement on a full-screen gate, then is forced to change the temporary password, before the console unlocks. Until accepted, no console access and no venue creation.
- **Plans:** an Admin-maintained catalog of templates (name, term, price; a zero price is a free term). Applied to an Owner as an instance with start/end. Editing a template never rewrites past instances; obsolete templates are archived.
- **Renewal:** a fresh Agreement is drafted and emailed; the Owner re-accepts. Expiring/expired Plans surface to the Admin with a filter, so renewals can be chased off-platform.
- **Payment is off-platform:** the system never collects Plan fees. A single platform bank account (from Settings) is included in the credentials email and shown in the Owner's Plan page.
- **Grandfathering:** existing owners keep console access and get a "contact admin to set up your plan" banner until an Admin provisions them.
- **Self-submit venue path is deprecated** in favor of this flow; only accepted-terms owners can create Venues.

## Trade-offs / consequences

- Admin-provisioned accounts invert the signup model (backend now creates Firebase users) and make onboarding the single gate to ownerhood — hard to reverse once live.
- Plaintext temporary passwords travel by email; mandatory rotation on first sign-in mitigates exposure.
- Per-owner Plan/Agreement data is net-new (plans, owner_plans, agreements, leads tables) and keeps a full history for renewals.