-- 0005_user_fcm_token.sql
alter table users add column if not exists fcm_token text;
