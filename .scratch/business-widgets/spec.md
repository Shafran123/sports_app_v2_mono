# Business-scoped widget instances: owner grouping, per-instance venue pinning and selection

Status: ready-for-agent

## Problem

The Booking Widget and its Brand tokens are keyed per **Venue** (`venues.widget_key`, `allowed_domains`, `brand`, `widget_enabled`). That is wrong: the widget serves the **owner's** audience, not the venue's. An owner with three venues must today copy three different embed snippets — and there is no venue-selection step, no ability to pin a widget to one venue while hiding the selector, and no home for the owner's own brand. It also blocks the future own-domain plan (a Business = brand + venue portfolio).

## Decisions (grilled 2026-08-25, see ADR 0028 amendment)

- **A `Business` entity one-per-Venue-Owner** (schema allows N, MVP creates exactly one). Venues move under the Business (`venues.business_id`); the Owner account *manages* the Business, the Business is the *public brand*. No businesses/switchers UI now.
- **Widgets become `widget_instances` owned by the Business** — many per Business. Each instance carries: its own **Embed Key**, a required name ("Main site", "Weekend promo"), a **Default Venue**, a "let customers choose venue" toggle, per-instance **allowed domains**, and an enabled flag.
- **Venue selection in the widget:** instances with the toggle ON show a venue step (Default Venue preselected); toggle OFF → selector hidden, only the Default Venue is bookable; a Business with ≤1 approved venue never shows the selector. The Default Venue is enforced server-side at checkout, not just in the UI.
- **Eligible venues** for an instance = all **approved** venues of its Business — **Private Venues included** (their widget is their only public surface). Suspended/banned/archived venues are excluded by status. An unavailable Default Venue falls back to selector-on with no preselect; never a dead embed.
- **Per-venue widget control is deleted.** The venue's `widget_key`, `allowed_domains`, `widget_enabled`, and `brand` columns are dropped (migration 0021). Old `/embed/<venueKey>` URLs 404 — acceptable, only dev-local snippets exist.
- **Branding moves to the Business** (name, colors, logo, tagline). The **Branded Venue Page** (`/<slug>`) keeps its per-venue URL and venue content but renders Business brand chrome.
- **Console:** a new top-level **"Widget & site"** page (business name/brand + instance list + per-instance defaults/domains/copy-snippet/delete). The per-venue "Widget & page" tab is removed.
- **Migration 0021 also fixes the 0020 slug bug**: recompute `venues.slug` with lowercase-first slugify (matching `sp_be/utils/widget.js`; 0020's SQL stripped uppercase letters).
- Business name at creation = the owner's venue name; brand = platform defaults. Owner edits later in "Widget & site". Owner Plans/Agreements stay keyed to the Owner account — no change.
- Checkout accepts the instance's embed key; server validates instance enabled + chosen court's venue ∈ eligible set + (if locked) court's venue == Default Venue.

## Build order

Data migration → business + instance services → public widget API re-scope → checkout scoping → user-app widget flow (venue step) → branded-page business brand → console "Widget & site" page.

## Out of scope (v2 trails, unchanged)

Owner-gateway abstraction + embedded checkout (P1/P2). Portfolio pages (multi-venue, one Business). Custom domains (`book.theirsite.com`). Multi-Business-per-Owner UI. Widget for Events.