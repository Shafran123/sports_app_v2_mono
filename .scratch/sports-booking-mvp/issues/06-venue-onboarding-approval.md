# 06 — Venue onboarding + admin approval

**What to build:** a venue owner can submit their venue (business details, address with map pin, photos, sports, courts with prices) and the admin can approve or reject it with a reason. Approved venues become publicly listed; pending venues are not. Owner gets an email on approval/rejection.

**Blocked by:** 04 — Auth & profiles.

**Status:** ready-for-agent

- [ ] Owner registration + venue submission form (details, map pin, photo upload, sports selection, initial courts with prices) reaches the API
- [ ] New venues are `pending` and invisible in public discovery until approved
- [ ] Admin UI lists pending venues, approves or rejects with a reason; approval email (Resend) sent to the owner
- [ ] The venue owner role is assigned to the submitting account on approval

## Comments
Completed: 2026-08-19
