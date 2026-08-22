# 0018 — Tax: configurable exclusive rate, snapshotted server-side, excluded from revenue

- **Status:** accepted
- **Date:** 2026-08-22

## Context

The platform needs tax collection configuration on bills and reports. Prices are stored as integer LKR; gate amounts are server-derived (ADR-0015); booking rows already snapshot `total_price`.

## Decision

- `tax_rate` (percent, default 0) in `platform_config`, admin-editable.
- At checkout: `tax = halfUp(base × rate / 100)`; `total = base + tax`; both `tax_rate` and `tax_amount` snapshotted onto the Booking and Event Registration rows (registrations also gain `base_amount`/`total_amount`). Later rate changes never rewrite history.
- **Revenue is net of tax**; tax is a separate collected-liability figure in every report.
- When rate = 0, bills and reports show **"Tax not applicable"** — never a 0.00 line.
- Bills are statelessly regenerated PDFs (no storage) with QR barcode; emailed on payment confirmation (walk-in guests: print-only).

## Trade-offs / consequences

- Exclusive pricing exposes the real mechanics to the player (base + tax = total) and keeps the trust model intact — amounts still derive server-side.
- Snapshot columns are durable and auditable; future PayHere charge uses the tax-inclusive total.
- Zero-rate presentation avoids "why 0.00?" confusion.