# 0029 — Dedicated Sites: per-Business multi-venue websites on the Business's own hostname

- **Status:** accepted
- **Date:** 2026-08-25
- **Supersedes in part:** ADR-0028 (Branded Venue Page for site businesses; portfolio pages and custom domains were v2 trails there)

## Context

Field feedback after P0: venue owners don't want a marketplace listing — they want a **storefront that is theirs**, on their own domain, under their own brand, selling their own courts. The earlier v2 trails recorded "portfolio pages" and "custom domains" separately (ADR-0028); the business need pulls both forward into one concept. A Dedicated Site is unlike the Booking Widget (no iframe) and unlike the Branded Venue Page (one URL on the platform): it is a full, indexable, multi-venue website served on the Business's own hostname, running the exact app booking flow.

## Decision

- **One Business → one Dedicated Site → one Site Hostname.** A Site Hostname is exactly one per Business: either the owner's own hostname (`abc.lk`, apex plus `www.` configured together as one) or a platform-proposed `<brand-slug>.myslot.lk` subdomain (uniqueness-checked). Every hostname — subdomain or owner domain — goes through an admin **Site Domain Request**; no hostname is auto-provisioned without approval.
- **The site is not an iframe.** It renders the full app booking flow (sign-in, checkout, holds, QR, payments per the venue's own capability) wrapped in Business brand chrome and site-level presentation (hero, intro, contact, footer) instead of the marketplace shell. It is served by the shared user app with host-based routing (env/hostnames DB-driven); no per-owner deploy.
- **Portfolio root + per-venue pages.** Root lists the Business's venues; a first-visit "pick a venue" popup appears for 2+ approved venues, and a persistent "Switch venue" control lives on every venue page. Venue URLs on the site use `/<slug>`.
- **Private Venues appear on the site** and may surface in the in-app storefront as a link out to the site. The Private Venue definition is amended: invisible to marketplace discovery, but visible on its own Business's surface.
- **The slug-based Branded Venue Page is superseded for site businesses.** `myslot.lk/<slug>` remains only as the platform fallback for businesses without a live site; once a business has a live site, its slug pages are redirected/noindexed in favor of the site host.
- **Trusted origins become DB-driven.** Live Site Hostnames are runtime origins for REST CORS and sockets, alongside the env-based origins. Per-hostname platform steps that remain manual (auth-provider authorized domain, hosting-domain configuration) are tracked as a checklist inside the request.
- **Payments stay per-venue capability.** Marketplace-visible venues keep platform PayHere as today; Private Venues stay cash-first until the owner-gateway (P1/P2) lands. The site never invents a gateway.
- **Site bookings carry site context** (like widget bookings carry `widget_instance_key`) so allowance counting, reporting, and check-in behave consistently.
- **Plan lapse:** a lapsed plan serves a branded offline slate on the site host while confirmed bookings play out (same rule as widget/branded page).

## Trade-offs

- **Shared app with host-based routing vs per-owner deploy**: one codebase and one env/Firebase/domain surface, at the cost of host-based rendering logic and per-owner origin entries.
- **DB-driven trusted origins vs env-only**: enables arbitrary owner hostnames at runtime (no redeploy per customer), at the cost of trusting the request workflow to gate origins.
- **Full app flow vs widget flow**: the site reuses the proven marketplace checkout (login, PayHere where applicable), at the cost of a heavier identity step than the widget's phone-verify.

## Consequences

- New/amended concepts in CONTEXT.md: **Dedicated Site**, **Site Hostname**, **Site Domain Request** (+ states), Private Venue definition amended, Branded Venue Page note for site businesses.
- Data: site hostname(s) verified + live state, request workflow rows, origin resolution from live hostnames.
- Owner console and admin console: a dedicated "Site" surface — owner submits/edits/restates its request; staff run a queue + per-request DNS/console checklist.
- The marketplace storefront starts routing site-owning businesses' venues to the site.
- Future trails unchanged: owner-gateway abstraction (P1/P2), multi-Business-per-Owner UI, multiple hostnames per site (deliberately one hostname per site today).