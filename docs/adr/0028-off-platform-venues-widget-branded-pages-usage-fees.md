# 0028 — Off-platform venues: private venues, booking widget, branded pages, and the usage-fee model

- **Status:** accepted
- **Date:** 2026-08-25

## Context

The marketplace model (discoverable venues, PayHere on the platform merchant, admin-curated owner onboarding) serves the current customer type: venues that want to be found on MySlot.LK. A new customer type needs onboarding: venues that do **not** want to appear on the platform at all — they want to sell their own courts to their own audience from their own website, under their own brand, and still use the booking engine, QR check-in, and cash handling. Separately, the commercial model shifts from a fixed Owner Plan to a usage-based fee: free allowance + overflow platform fee, and online payments move from the platform's gateway to the owner's own gateway.

## Decision

- **A Private Venue is a Venue**, not a new entity: same courts, slots, holds, bookings, QR tokens, cash payments. The only difference is a visibility flag that removes it from browse/search/all in-app surfaces. (ADR: no parallel booking stack.)
- **Every venue can get a Booking Widget** (embed id + owner-managed domain allowlist) and a **Branded Venue Page** (`myslot.lk/<slug>`, white-labeled, indexable, one venue per URL; portfolio pages are v2). Private venues require both; public venues may add them. The widget is the same booking engine with the chrome stripped — same checkout, holds, QR, cash invariants as the player app.
- **Widget buyers verify a phone and get a Player account** (auto-created + phone-verified on first booking, or sign-in for existing accounts). QR/confirmation show on the widget success screen and are delivered by SMS/email — a fresh widget Player may never open the player app.
- **P0 checkout is cash-only.** The widget offers cash-at-venue; the owner records the Cash Payment at check-in (existing flow). No gateway code in P0.
- **Online payments (P1/P2) run on the owner's gateway.** The platform holds owner-supplied encrypted gateway credentials and initiates payments and refunds on the owner's behalf; PayHere first, behind one owner-gateway abstraction; embedded checkout inside the iframe (no redirects). The P0 success screen is built as the terminal step these flows will later return to.
- **The commercial model is platform-wide and plan-driven.** Owner Plan templates gain a monthly **Booking Allowance** (one count per booking; cancelled/refunded don't count; multi-slot bookings count once; walk-ins count) and an **Overflow Platform Fee** (default 5%) applied beyond it, billed off-platform from platform booking data. The 3-month free trial stays a zero-price template with the standard allowance.
- **Lapsed plans get a grace period, then the widget + branded page go offline** while already-confirmed bookings play out. Marketplace-visible venues are unaffected.
- **The Owner Agreement is re-versioned** on this commercial change; owners re-accept on renewal.

## Trade-offs

- **Cash-first P0** defers all gateway work (per-owner credentials, encryption, abstraction, embedded checkout) — the riskiest part of the new model — until the flow is proven, at the cost of online bookings not being available off-platform at launch.
- **Owner's gateway vs platform gateway:** online money flows to the owner, so the platform never handles funds for private venues — but the platform must hold and use owner credentials (encrypted), which is a security and compliance surface accepted for P1/P2.
- **Auto-created widget Players** reuse the entire player machinery (QR, reminders, history, sign-in) instead of inventing a guest identity, at the cost of the platform owning a Player record for a user who may never open the app.
- **Off-platform billing for the overflow fee** matches how Owner Plan fees are collected today (no gateway dependency), but relies on the platform's own data as the tally and on the owner paying an invoice.

## Consequences

- New concepts in CONTEXT.md: **Private Venue**, **Booking Widget**, **Branded Venue Page**, **Booking Allowance**, **Overflow Platform Fee**; QR Token note for widget delivery; Branded Venue Page note for portfolio-as-v2.
- Data: venue visibility flag, widget/embed key + domain allowlist, per-venue brand tokens (colors, logo, tagline, photos, about), plan allowance/overflow fields, agreement versioning.
- The landing app (`myslot.lk/<slug>`) and a no-chrome widget route render from the same booking engine; no new booking stack.
- v2 trails recorded separately: owner-gateway abstraction (P1/P2), portfolio pages, custom domains.

## Amendment (v1.5, 2026-08-25) — widget scope moves from Venue to Business

Field feedback after P0 shipped: the widget serves the **owner's audience**, not the venue's, and the future own-domain/portfolio trail needs a Business-shaped anchor. This amendment supersedes the per-venue widget design (venue-level `widget_key`, `allowed_domains`, `brand`, `widget_enabled` are dropped in migration 0021):

- **Business**: a new one-per-Owner entity (schema N, MVP 1) that owns the Brand tokens (colors, logo, tagline) and aggregates the Owner's Venues. The Owner account manages it; the Business is the public brand.
- **Widget Instance**: a Business-owned embeddable booking surface, many per Business. Each has its own **Embed Key**, required name, **Default Venue**, a "let customers choose venue" toggle, per-instance domain allowlist, and enabled state. Owners create one instance per venue/marketing page — e.g. three venues → three embeds, each pinned or free-choice.
- **Venue selection**: toggle ON → selector shows (Default Venue preselected); OFF → only the Default Venue, enforced server-side at checkout (the instance key travels with the booking), never just in the UI. Eligible venues = all approved venues of the Business, Private included. A stale Default Venue degrades to selector-on, never a dead embed.
- **Branded Venue Page** (`myslot.lk/<slug>`): stays per-venue URL + venue content, but its chrome renders **Business** brand; the portfolio page remains v2.
- **Console**: per-venue "Widget & page" tab is replaced by a top-level **Widget & site** page (business name/brand + instance list + per-instance defaults/domains/embed snippets).
- Commercial model (plans, allowance, overflow, lapse) is unchanged and stays keyed to the Owner account.
- Deliberately **not** decided now: multi-Business-per-Owner UI (schema-ready only), portfolio pages, custom domains, offline-instance key rotation.
