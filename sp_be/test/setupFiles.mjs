import { inject } from 'vitest';

process.env.DATABASE_URL = inject('databaseUrl');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.OTP_HMAC_SECRET = process.env.OTP_HMAC_SECRET || 'otp-test-key';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
process.env.PAYHERE_MERCHANT_ID = process.env.PAYHERE_MERCHANT_ID || 'TEST_MERCHANT_ID';
process.env.PAYHERE_MERCHANT_SECRET = process.env.PAYHERE_MERCHANT_SECRET || 'test-merchant-secret';
// Give the suite generous headroom for the per-player hold cap; the
// security test pins HOLD_LIMIT=3 to exercise the real production default.
process.env.HOLD_LIMIT = process.env.HOLD_LIMIT || '50';
