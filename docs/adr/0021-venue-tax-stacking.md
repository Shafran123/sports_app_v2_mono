# 0021 — Tax: inclusive pricing, platform + venue rates stacked

- **Status:** accepted (supersedes 0018 for the rate and pricing semantics)
- **Date:** 2026-08-23

## Context

0018 established a single admin-configured exclusive `tax_rate`, added on top of listed prices and snapshotted per booking. The owner now wants owners to set their own per-venue rate, and for prices to be **inclusive** — the listed price is the total the player pays, and taxes are carved out of it at checkout. The owner sets their rate knowing the split (the UI shows "what you keep vs tax").

## Decision

- Two rates, both **inclusive**, both snapshotted separately on the Booking / Event Registration / Payment / Hold at creation:
  - **Platform Tax** — admin-configured, platform-wide, in `platform_config` (the existing `tax_rate`).
  - **Venue Tax** — owner-configured per Venue (`venue_tax_rate`), view-only to the Admin.
- At checkout: `base = total − platformTax − venueTax` using inclusive math (the existing half-up rounding for the split); the player's displayed price is the listed price, and the bill itemizes base + Platform Tax + Venue Tax.
- Both rates apply to court Bookings and Event Registrations, online and cash walk-in alike.
- A rate of zero is presented as "Tax not applicable" — no 0.00 line (kept from 0018).
- Revenue is net of both taxes; reports split the two lines. The Owner's share includes their Venue Tax; the Platform's share is Platform Tax.
- Owners set their own rate with a live "you keep vs tax" readout while setting it.

## Trade-offs / consequences

- Inclusive pricing changes the meaning of the court's listed price (it is now the total the player pays), so every price display and bill must be checked — the least-reversible part of this decision.
- Existing bookings keep their historical snapshots; only new checkout paths change.
- Walk-in cash bookings already back-derive inclusively today; this decision makes online checkout consistent with that path.