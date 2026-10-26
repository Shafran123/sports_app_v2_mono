import { inject } from 'vitest';

process.env.DATABASE_URL = inject('databaseUrl');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.OTP_HMAC_SECRET = process.env.OTP_HMAC_SECRET || 'otp-test-key';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
process.env.PAYHERE_MERCHANT_ID = process.env.PAYHERE_MERCHANT_ID || 'TEST_MERCHANT_ID';
process.env.PAYHERE_MERCHANT_SECRET = process.env.PAYHERE_MERCHANT_SECRET || 'test-merchant-secret';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://project.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
// Give the suite generous headroom for the per-player hold cap; the
// security test pins HOLD_LIMIT=3 to exercise the real production default.
process.env.HOLD_LIMIT = process.env.HOLD_LIMIT || '50';

// Tests must NEVER hit the real Mailgun/SMSGo endpoints — a local shell with
// live keys would otherwise send real email/SMS on every booking-flow test.
// Guard fetch so any send endpoint resolves to a fake success instead of the
// network; suites that assert on sends stub fetch themselves (their stub
// replaces this guard), suites that don't stub are covered by it.
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes('mailgun') || u.includes('smsgo')) {
    return {
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({ success: true, data: { id: 'msg_test_guard' } })
    };
  }
  return realFetch(url, opts);
};
