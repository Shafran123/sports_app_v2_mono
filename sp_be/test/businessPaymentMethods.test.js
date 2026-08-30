const { resolvePayhereCredentials, invalidateCredentials } = require('../services/businessPaymentMethods');
const secretManager = require('../services/secretManager');

describe('business payment methods — Secret Manager absent (dev/test)', () => {
  const original = process.env.SECRET_MANAGER_CREDENTIALS;

  afterAll(() => {
    invalidateCredentials('fallback-business');
    if (original === undefined) delete process.env.SECRET_MANAGER_CREDENTIALS;
    else process.env.SECRET_MANAGER_CREDENTIALS = original;
  });

  it('is not configured without SECRET_MANAGER_CREDENTIALS', () => {
    delete process.env.SECRET_MANAGER_CREDENTIALS;
    expect(secretManager.isConfigured()).toBe(false);
  });

  it('resolves the platform env keys as the business credentials', async () => {
    delete process.env.SECRET_MANAGER_CREDENTIALS;
    invalidateCredentials('fallback-business');
    const creds = await resolvePayhereCredentials('fallback-business');
    expect(creds.merchantId).toBe(process.env.PAYHERE_MERCHANT_ID || 'TEST_MERCHANT_ID');
    expect(creds.merchantSecret).toBe(process.env.PAYHERE_MERCHANT_SECRET || 'test-merchant-secret');
  });
});