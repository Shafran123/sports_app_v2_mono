# 05 — Owner Console: Customers directory (ADR 0030)

**What to build:** The Owner Console gains a Customers screen listing the Business's Site Customers — name, email, phone, joined date, last booking, bookings count, total spend — with search and CSV export. Data comes from `site_customers` + bookings via the site-customer-scoped history endpoint (04). This is the owner's own audience asset; access requires the Owner's console session, and data is strictly per-Business.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Owner Console route + nav entry for Customers
- [ ] Table: name, email, phone, joined, last booking, bookings count, total spend; search by name/email/phone
- [ ] CSV export of the current filtered set
- [ ] Strict per-Business scoping on the API (a Business can only ever see its own customers)
- [ ] Tests: directory rows, search, export CSV shape, cross-Business access denied