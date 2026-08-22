# 0013 — Phone verification via backend SMSGo OTP, not Firebase linking

Status: accepted

## Context

Court bookings must be gated on a phone number proven to belong to the Player. When the gate was designed (2026-08-22), several candidate mechanisms existed:

1. **Firebase phone auth as the proof** — treat the `phone_number` claim on a Firebase ID token as verification (the claim only appears after a Firebase OTP sign-in). Could be extended with `linkWithCredential` so Google accounts gain phone as a sign-in method, and the server reads the claim on every authenticated request.
2. **Backend-issued OTP via SMSGo.lk** — the Spots backend sends a code through the existing SMSGo integration (`utils/smsService.js`, `SMSGO_API_KEY`), stores a hash + expiry, and stamps `users.phone_verified_at` on confirmation. Independent of the identity provider.

## Decision

Phone verification is performed by the **Spots backend** issuing an SMS OTP through **SMSGo.lk** and recording it as `users.phone_verified_at`. Firebase Phone Sign-in does **not** confer verified status. Admins can explicitly mark players verified (pre-prod/test users). Verification is a **server-side gate**: `bookingController.checkout` rejects unverified users with `409 VERIFIED_PHONE_REQUIRED` regardless of client behavior.

## Consequences

- SMSGo is already integrated and env-configured; no new Firebase console changes, no region-policy/authorized-domain coupling, no ReCAPTCHA dependency for the verification flow.
- Verification state is explicit and durable (`phone_verified_at`), visible to admin and auditable — the claim-based alternative would have made verification implicit, invisible, and dependent on the last sign-in method used.
- A user whose phone came from Firebase Phone Sign-in still starts unverified and must complete the backend OTP once (or be marked by an admin) — friction that was accepted deliberately.
- Cost: one more SMSGo message per verification, a rate-limiting layer, and hashed-code storage (`verification_otps` table).
- Changing the phone number clears the stamp until re-verified; bookings snapshot `player_phone` at creation and are never rewritten.
- Walk-in quick-book and Event registrations are exempt (deliberate scope cut for the court-booking MVP).