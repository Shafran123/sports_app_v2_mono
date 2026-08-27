# 05 — Owner Invoices tab (backend list + admin UI)

Type: task
Status: ready-for-agent

## Completed

Implemented and verified. Evidence: backend suite 398/398, admin 59/59, api 25/25, typechecks green.

## Purpose

The owner console shows every bill — paid and still-due — with invoice number, player, booking, payment state, total, and a download action.

## Changes

Backend:
- `sp_be/controller/businessController.js` `listInvoices`: `GET /api/v1/business/invoices?from=&to=` (owner and admin) — bookings on the owner's venues with money snapshot + latest payment status/method/paid_at + `invoice_number`, ordered invoice-numbered-first then created desc. Default window 30 days.
- `sp_be/routes/business.js`: mount `router.get('/invoices', businessController.listInvoices)`.
- Owner bill download already exists (`GET /api/v1/bookings/:id/bill` allows the venue owner — `billController.downloadBookingBill`).

Frontend (`apps/admin`):
- `packages/api/src/index.ts` `business.invoices(client, params)` + `business.bookingBillUrl(bookingId)` (or a download helper) — typed, validated.
- `apps/admin/src/components/shell/sidebar.tsx`: add `Invoices` to `OWNER_NAV` (icon `Receipt`).
- `apps/admin/src/app/(shell)/invoices/page.tsx` + `features/invoices/invoices-page.tsx`: table (Invoice #, Player, Venue/Court, When, Payment, Total, Download) with a date-window picker; download opens the bill endpoint with the auth header.

## Audit

- [ ] invoices endpoint returns the right rows for owner + admin, scoped to the owner's businesses.
- [ ] sidebar shows Invoices for owners; page lists paid + due bills with download working.

