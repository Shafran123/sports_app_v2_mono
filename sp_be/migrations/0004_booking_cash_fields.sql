-- 0004_booking_cash_fields.sql
-- Support manual (cash) bookings created by venue staff.

alter table bookings add column if not exists player_name text;
alter table bookings add column if not exists player_phone text;
alter table bookings add column if not exists payment_method text not null default 'online' check (payment_method in ('online', 'cash'));
