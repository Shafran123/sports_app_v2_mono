-- Holds must support Site Customers (ADR-0030): a PayHere checkout from the
-- Booking Widget or Dedicated Site is made by a per-Business customer, whose
-- id lives in site_customers — not users. Mirror the bookings/payments shape:
-- user_id becomes nullable and site_customer_id references the customer row.
-- Without this, a site-customer PayHere checkout crashed with
-- "violates foreign key constraint holds_user_id_fkey" (the hold wrote the
-- site_customer id into users-referencing user_id).

alter table holds alter column user_id drop not null;
alter table holds add column site_customer_id uuid references site_customers(id) on delete cascade;