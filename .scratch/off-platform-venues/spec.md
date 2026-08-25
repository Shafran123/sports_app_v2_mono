# Off-platform venues: private venues, booking widget, branded pages, usage fees

Status: ready-for-agent

## Problem

The marketplace model only sells discoverable venues. A new customer type wants to sell their own courts to their own audience from their own website, under their own brand, never appearing in the MySlot app. The commercial model also shifts to usage-based fees, and online payments later move to the owner's own gateway.

## Decisions (grilled, see ADR 0028)

- A **Private Venue** is a Venue with a visibility flag: bookable but absent from all in-app surfaces.
- The **Booking Widget** (per-venue embed id + owner-managed domain allowlist) and the **Branded Venue Page** (`myslot.lk/<slug>`, white-labeled, indexable) are offered to any venue; private venues require them. Same booking engine, skin-deep differences only.
- Widget buyers verify a phone (auto-create a Player and verify, or sign in) — same QR/reminder/history machinery as players.
- **P0 checkout is cash-only** in the widget; online (owner's own gateway, embedded checkout, encrypted owner credentials) is P1/P2.
- QR + confirmation show on the widget success screen **and** ship by SMS/email for widget buyers.
- Commercial model goes platform-wide via Owner Plan: monthly **Booking Allowance** (X bookings; cancelled/refunded don't count; multi-slot counts once; walk-ins count) + 5% **Overflow Platform Fee**, billed off-platform from booking data.
- Lapsed plans: grace period, then widget + branded page go offline; confirmed bookings still play out. Owner Agreement re-versioned; re-accept on renewal.

## Build order

Backend foundations → widget identity/checkout → branded page + embed route → console surface → plans/allowance/billing.

## Out of scope (v2 trails)

Owner-gateway abstraction + encrypted credentials + embedded checkout (P1/P2). Portfolio pages (multi-venue, one owner). Custom domains (`book.theirsite.com`). Widget for Events. Walk-in quick-book POS changes (existing path stays).