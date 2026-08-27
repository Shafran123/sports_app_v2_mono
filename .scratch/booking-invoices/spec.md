# Booking Invoices — spec

The Booking Bill becomes a proper computer-generated invoice: per-Business sequential invoice numbers, rich PDF with business logo + details and a bordered money table, no check-in QR anywhere on it. The cash bill email moves from check-in to **mark-paid** (online bookings keep billing at check-in; the confirmation email never carries a bill, so no more "two emails at once"). Walk-in bookings SMS the customer a tokenized bill download link (they already give a phone at quick-book). The owner console gains an **Invoices** tab listing all bills (paid + due) with download.

Resolved in grilling:

- Q1: the "two emails" came from owner clicking confirm and check-in together. Cash bill trigger moves to mark-paid; online stays at check-in.
- Q2: no merging — confirmation email carries no bill. Keep current split.
- Q3: QR removed from bill entirely (PDF + email body); confirmation/reminder keep QR.
- Q4: rich invoice — logo, business details, bordered table, tax rates with %, invoice number, payment state.
- Q5: events out of scope.
- Q6: per-Business sequential invoice number, persisted on the booking, allocated at first emission, never renumbered.
- Q7: owner Invoices tab lists all bills incl. still-due ones.
- Q8: per-slot item lines when the court price is uniform over the booking, else a single item line.
- Q9: walk-in prints lose the QR too (front desk checks in via console); the walk-in's phone gets an SMS with a tokenized bill link.