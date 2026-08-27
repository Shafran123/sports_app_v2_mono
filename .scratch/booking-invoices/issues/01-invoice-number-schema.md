# 01 — Invoice numbers: schema + allocation

Type: task
Status: ready-for-agent

## Completed

Implemented and verified. Evidence: backend suite 398/398, admin 59/59, api 25/25, typechecks green.

## Purpose

Every Booking Bill carries a stable, per-Business sequential invoice number, allocated once at first emission and never renumbered.

## Changes

- Migration `0031_invoice_number.sql`: `alter table bookings add column invoice_number int;` plus a partial unique index on `(business_id, invoice_number) where invoice_number is not null`.
- `sp_be/utils/billService.js`: `allocateInvoiceNumber(bookingId)` — `select coalesce(max(invoice_number),0)+1 from bookings where business_id=$1 and invoice_number is not null`, then `update bookings set invoice_number=$2 where id=$3 and invoice_number is null`; on rowCount 0 re-read and reuse; retry loop on concurrent conflict. Called from `bookingBillPdf` (first render = first emission) so email, walk-in SMS download and owner download all stamp the same number.
- `bookingBillPdf` returns the allocated number so callers can surface it (walk-in SMS text).

## Audit

- [ ] booking row gets `invoice_number` on first PDF render and keeps it on later renders.
- [ ] two concurrent first-renders of the same booking yield one number, no conflict.
- [ ] two bookings in the same Business get distinct numbers; different Businesses restart their own sequence.

