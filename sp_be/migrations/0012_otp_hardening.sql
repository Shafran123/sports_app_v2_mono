-- 0012_otp_hardening.sql
-- Security hardening: salt OTP hashes so a leaked DB cannot be brute-forced.
-- Replaces the unsalted sha256(code) scheme with sha256(salt || code).
-- Outstanding codes are invalidated (they are 10-minute codes anyway).

alter table verification_otps add column if not exists salt text;

update verification_otps
   set expires_at = now() - interval '1 minute'
 where expires_at > now();