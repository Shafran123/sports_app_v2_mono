-- 0003_payments_manual_refund_flag.sql
-- Flag payments that reached the gateway but could not be applied to a booking,
-- so the admin can refund them manually.

alter table payments add column if not exists needs_manual_refund boolean not null default false;
