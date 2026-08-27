# 02 — Invoice PDF redesign (rich, no QR)

Type: task
Status: ready-for-agent

## Completed

Implemented and verified. Evidence: backend suite 398/398, admin 59/59, api 25/25, typechecks green.

## Purpose

The bill is a proper computer-generated invoice: business logo + business details, a bordered table, tax lines with rates, invoice number — and no check-in QR.

## Changes

- `sp_be/utils/billService.js` `renderBookingPdf`:
  - Header: business logo (fetch `business_brand.logo_url` → buffer; graceful fallback to the business name in its primary color), business name, "Invoice" title, **invoice number**, issued timestamp.
  - From block: business name + `brand.contact` (phone, email, address, hours) with venue phone/address as fallback.
  - Bordered money table: item lines then Subtotal, Offer discount, Platform tax (with rate %), Venue tax (with rate %), bold Total.
  - Itemization (Q8): when the court's price is uniform over the booking (slot count = duration / `slot_duration_min`, unit price = subtotal / slot count, rounding-consistent, count ≤ 12), one line per slot ("Wed, 5 Aug · 6:00 PM – 7:00 PM · LKR 500"); else a single item line with the subtotal. Requires `c.slot_duration_min` in `BOOKING_BILL_SELECT`.
  - Payment line: Cash — Paid / Cash — Due / Paid online, paid timestamp, booking status.
  - **Remove** the QR embed and "Show the QR at the venue to check in." caption.
- Tax lines show the rate, e.g. "Platform tax (7%)".

## Audit

- [ ] PDF renders logo or graceful text fallback; business details present.
- [ ] bordered table renders; amounts right-aligned; Total bold.
- [ ] per-slot lines for uniform price; single line otherwise.
- [ ] no QR in the PDF bytes (no `/img` qr image, no caption).

