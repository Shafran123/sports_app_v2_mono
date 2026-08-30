-- 0036: Per-Business PayHere secrets move out of Postgres into Google Secret
-- Manager (ADR-0047) — merchant_secret/app_secret are no longer tenant data
-- in the DB, so the encrypted columns are dropped. merchant_id/app_id stay:
-- they are not secret, and drive payhere_configured plus the owner/admin UI
-- hints. Run the one-off scripts/backfillPayhereToGsm.js BEFORE this
-- migration on any environment that still holds encrypted credentials.

alter table business_payment_methods
  drop column if exists merchant_secret_enc,
  drop column if exists app_secret_enc;