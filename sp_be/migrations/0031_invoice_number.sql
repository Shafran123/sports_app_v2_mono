-- 0031_invoice_number.sql
-- ADR-0041: Booking Bills become invoices with a per-Business sequential
-- invoice number, allocated once at first emission and never renumbered.
-- Persisted on the booking so the PDF, the walk-in SMS link, and the owner
-- Invoices tab all show one stable number. Uniqueness per Business is enforced
-- by a per-business advisory lock in billService.allocateInvoiceNumber
-- (bookings carries no business_id; the Business resolves via court -> venue).

alter table bookings add column if not exists invoice_number int;
