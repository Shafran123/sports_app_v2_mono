# 07 — Post-cutover end-to-end verification

Type: task
Status: ready-for-human

## Context

Everything deployed (tickets 04–06). Prove the pre-prod stack works end-to-end against the fresh DB, and that the decisions hold (sandbox PayHere, volume persistence, origin split).

## Checklist

- [ ] `GET /health` on Railway → 200; boot log only expected warnings.
- [ ] `schema_migrations` = 14 rows; seed present (18 sports, seed venues, demo accounts).
- [ ] User app loads; Firebase sign-in works (same Firebase tenant as local).
- [ ] Browse venues → venue detail renders photos from Supabase Storage (absolute URLs, no rewrite needed).
- [ ] Booking: flip `payhere_enabled` ON via admin Platform Settings → sandbox PayHere checkout round-trips, **`return_url` lands on the user app** (proves `FRONTEND_URL` semantics).
- [ ] Cash payment + walk-in guest (quick-book POS) flow works; booking QR renders.
- [ ] Confirmation email (Mailgun) and SMS (SMSGo) arrive with working links.
- [ ] Check-in: admin console front desk scans the QR → token consumed; second scan rejected.
- [ ] Admin: overview metrics, reports charts, tax settings, feature-flag toggle (audit row written).
- [ ] Admin photos: upload via venue form → image 200 on both apps' origins (absolute Supabase URL).
- [ ] **Persistence**: trigger a Railway redeploy → previously uploaded image still 200 (Supabase Storage; the volume is gone).
- [ ] Reminder job registered on boot; digest email scheduled 06:06 Asia/Colombo.

## Done

- [ ] Every box above verified live on the deployed URLs; any failure promoted to a new ticket with the failing URL + symptom.

Blocked by: 04, 05, 06