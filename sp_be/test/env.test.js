const { validate, missingKeys } = require('../config/env');

describe('fail-closed env validation', () => {
  const FULL_ENV = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgres://db',
    FRONTEND_URL: 'http://app.local',
    PAYHERE_MERCHANT_ID: 'm1',
    PAYHERE_MERCHANT_SECRET: 's1',
    GOOGLE_APPLICATION_CREDENTIALS: '/tmp/sa.json',
    MAILGUN_API_KEY: 'mg',
    SMSGO_API_KEY: 'sg',
    OTP_HMAC_SECRET: 'otp',
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test'
  };

  it('reports every missing required key in production', () => {
    const missing = missingKeys({ NODE_ENV: 'production' });
  });

  it('throws listing the missing keys (fail closed) in production', () => {
    expect(() => validate({ env: { NODE_ENV: 'production', DATABASE_URL: 'x' }, nodeEnv: 'production' })).toThrow(/PAYHERE_MERCHANT_ID/);
  });

  it('accepts a fully configured production environment', () => {
    expect(() => validate({ env: FULL_ENV })).not.toThrow();
  });

  it('never blocks the test environment', () => {
    expect(() => validate({ env: { NODE_ENV: 'test' }, nodeEnv: 'test' })).not.toThrow();
  });

  it('accepts FIREBASE_SERVICE_ACCOUNT instead of GOOGLE_APPLICATION_CREDENTIALS', () => {
    const env = { ...FULL_ENV };
    delete env.GOOGLE_APPLICATION_CREDENTIALS;
    env.FIREBASE_SERVICE_ACCOUNT = 'base64';
    expect(() => validate({ env })).not.toThrow();
  });

  it('treats secrets as missing when firebase is unresolved', () => {
    const env = { ...FULL_ENV };
    delete env.GOOGLE_APPLICATION_CREDENTIALS;
    delete env.FIREBASE_SERVICE_ACCOUNT;
    env.HOME = '/nonexistent';
    expect(() => validate({ env })).toThrow(/GOOGLE_APPLICATION_CREDENTIALS/);
  });
});