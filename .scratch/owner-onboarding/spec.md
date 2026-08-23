# Owner Onboarding, Owner Console, and Tax Stack

Status: ready-for-agent

## Problem Statement

Four missing pieces block the platform's owner-side story:

1. **Owner tax** — today there is one admin-set platform-wide `tax_rate`, applied exclusively (added on top) at checkout. Owners need their own per-venue rate, prices must be **inclusive** (the listed price IS the total the player pays), and the two taxes must be carved out and snapshotted separately. The owner sets their own Venue Tax; the admin may view it but not edit it.
2. **Owner dashboard is empty** — the owner branch of the admin console shows only three stat cards. It needs the same charts the admin sees: revenue/tax bar, bookings/day line, bookings-by-sport, payment split, with a 7/30/90 range toggle and a venue filter when the owner has several venues.
3. **Owner Bookings tab missing** — the owner console has no bookings lookup surface. Front desk is day-of operations (check-in, QR, quick-book); a new **Bookings** tab provides date-range lookup with status/venue/sport filters and pagination.
4. **Owner onboarding doesn't exist** — no way for a venue to get listed by an interested party, no Leads tab, no Plans, no Agreements, no admin-created owner accounts, and no gate on console access.

The self-submit path ("any signed-up player can submit a venue and get promoted on approval") is **deprecated** — onboarding through an admin-provisioned account is the only way to become a Venue Owner.

## Solution

### 1. Venue Tax (inclusive, stacked with Platform Tax)

- **Platform Tax** (admin, platform-wide, `tax_rate` in `platform_config`): stays admin-only.
- **Venue Tax** (`venue_tax_rate` on Venue): set by the owner per venue; admin sees it read-only.
- Both are **inclusive** and **additive**: the listed price is the total the player pays; at checkout the platform splits out `base`, `platform_tax`, `venue_tax` and snapshots all three on the Booking / Registration / Hold / Payment. Zero rate → "Tax not applicable", no 0.00 line.
- Apply to court Bookings and Event Registrations, online and cash walk-in alike. Walk-in already back-derives inclusively today — online checkout must match.
- While setting their rate, the owner sees a live readout: "at this rate, of a 100 LKR price you keep X, tax to platform Y, tax to you Z."
- Admin reports: revenue is net of both taxes; `platform_tax` and `venue_tax` are separate collected rows in reports and daily digest. Owner's dashboard splits revenue vs the tax they collect.

### 2. Owner dashboard charts

- New owner reports endpoint (time-series like `admin.reports`): `GET /business/reports?range=7|30|90&venueId=` returning series (day → bookings, revenue, taxes), by-sport, by-venue (when owned), payment split (online vs cash).
- Charts on the owner dashboard (recharts, same as settings): revenue & tax bar, bookings/day line, bookings by sport, online-vs-cash pie.
- Range toggle + venue filter when the owner has multiple venues.
- Empty-state: "Create your first venue" CTA replaces charts when the owner has no venues.

### 3. Owner Bookings tab

- New sidebar item **Bookings** (owner): server-side list with `dateFrom`/`dateTo` (default all-time or today), status, venue, sport, court, pagination.
- Front desk remains day-of operations (check-in/QR/quick-book/cash). The new tab is for lookup/audit.

### 4. Owner onboarding

#### Leads
- Public "Want to list your place?" form (home banner CTA + `/become-owner` page): name, email, phone, venue name, city, message (optional). Stored in `owner_leads` with status `new → contacted → converted / closed`.
- New admin **Leads** tab: list, mark contacted, convert (pre-fills create-owner), close. Duplicate emails/venue names flagged for human judgement. New lead → notify admins (email + in-app).
- Convert **never mutates an existing player account** — a new owner account is always created; colliding emails must be changed by the admin.

- **Create owner** (from Lead or directly): admin supplies unique email, temporary password, Plan (from catalog) and start date, and drafts the Agreement. On submit the backend creates the Firebase user (`venue_owner` role), attaches the Plan and Agreement, and emails the owner: credentials + the agreement (PDF) + platform bank details.

#### Plans
- Admin-maintained **plan catalog** (templates): name, term (e.g. 6 months / 1 year), price (zero = free). Archived templates stay in history but aren't selectable for new owners.
- Applying a template creates an **owner_plan instance** with start + end (start = admin-set date, end = start + term).
- Admin **Owners** view: every owner with plan start/end; filter "expiring in N days" (e.g. "ends tomorrow"); actions: **renew** (draft a new agreement, email it, owner accepts) and nudge.

#### Agreements
- **Agreement template** with per-owner placeholders (owner name, business, plan, dates, bank account, terms). Admin drafts/edits it when creating the owner; generated as a PDF in the email and in the owner's console.
- First sign-in: full-screen agreement → **Accept** → forced password change → console. Declining blocks console.
- Sidebar **Plan & Agreement** page: current plan (start/end/status), bank details, agreement + PDF, renewal history, accept button.
- Expiry is non-enforcing: an expired plan keeps console access but shows a "plan ended on …" warning; admin chases renewal off-platform.

#### Deprecating self-submit
- Closing the old path: only accepted-terms owners can create Venues. Existing owners get a **grandfathered** banner ("contact admin to set up your plan") until an admin provisions them; pending pre-onboarding venue submissions still get reviewed.

## Implementation Decisions

- Tax flips to **inclusive everywhere** (ADR-0021) — the listed price is the total the player pays, and the platform/venue split is derived at checkout. Historical bookings keep their snapshots.
- Owner accounts are **admin-provisioned only**; the backend creates Firebase users (ADR-0022).
- Plan/agreement data is net-new tables (`owner_leads`, `owner_plans`, `owner_agreements`, plus `venues.venue_tax_rate` and tax snapshot columns).
- Recharts already in admin app; reports reuse the admin/reports shape.

## Out of Scope

Plan fee collection (off-platform bank transfer — the email surfaces the platform bank account). Automated expiry enforcement. Venue-specific Agreements (the Agreement is owner-scoped, covering all their venues). Converting existing player accounts into owners (never done). Re-opening the self-submit path.

## Further Notes

- The `venue_tax` split affects existing tax paths (checkout, cash back-derive, PayHere webhook, bills, reports). All of these must be revalidated as one unit when the engine flips.
- The owner console lives inside the admin app; the owner dashboard, owner Bookings tab, and Plan & Agreement page all appear in the owner-side sidebar (which already forks by role).