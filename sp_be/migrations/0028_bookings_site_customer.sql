-- 0028_bookings_site_customer.sql
-- ADR-0030: a Booking references exactly one of the platform Player
-- (bookings.user_id) or a Site Customer (bookings.site_customer_id). Site
-- bookings keep their site context too (site_hostname from ADR-0029).

alter table bookings add column if not exists site_customer_id uuid
  references site_customers(id);

-- Site bookings carry site_customer_id instead of user_id (walk-ins have
-- neither); allow the platform reference to be null.
alter table bookings alter column user_id drop not null;

-- Booking rows carry user_id for platform Players and site_customer_id for
-- Site Customers; a walk-in guest has neither. No row may ever carry both.
-- (Existing table has no constraint; the gate lives in the checkout path.)
create index if not exists bookings_site_customer_idx on bookings (site_customer_id);