// Boot-time Platform Secret resolution from Google Secret Manager
// (config/platformSecrets.js, ADR-0046). Tests exercise the real JWT signing
// with a generated RSA key but mock `fetch`, so no network is touched.

const crypto = require('node:crypto');
const { loadPlatformSecrets, isConfigured, parseCredentials } = require('../config/platformSecrets');

function makeCredentials() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    client_email: 'secrets@myslot-preprod.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    // public key kept so a test could verify the assertion if needed
    _publicKey: publicKey
  };
}

function secretPayload(name) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ payload: { data: Buffer.from(`value-${name}`).toString('base64') } })
  };
}

function tokenOk() {
  return { ok: true, status: 200, json: async () => ({ access_token: 'test-token' }) };
}

describe('platform secrets bootstrap (ADR-0046)', () => {
  it('is a no-op when SECRET_MANAGER_CREDENTIALS is unset', async () => {
    const fetchImpl = vi.fn();
    const env = { SOME_DIRECT_VALUE: 'x' };
    const result = await loadPlatformSecrets({ env, fetchImpl });
    expect(result).toEqual({ injected: [], missing: [], skipped: expect.any(Array) });
    expect(result.skipped.length).toBeGreaterThan(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('injects every platform secret from GSM into env', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).includes('oauth2.googleapis.com')) return tokenOk();
      if (String(url).includes('secretmanager.googleapis.com')) {
        const name = String(url).split('/secrets/')[1].split('/')[0];
        return secretPayload(name);
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    const env = { SECRET_MANAGER_CREDENTIALS: Buffer.from(JSON.stringify(makeCredentials())).toString('base64') };

    const result = await loadPlatformSecrets({ env, fetchImpl });

    expect(result.injected).toEqual(expect.arrayContaining(['PAYHERE_MERCHANT_SECRET', 'MASTER_ENCRYPTION_KEY', 'FIREBASE_SERVICE_ACCOUNT']));
    expect(result.missing).toEqual([]);
    expect(env.PAYHERE_MERCHANT_SECRET).toBe('value-PAYHERE_MERCHANT_SECRET');
    expect(env.MASTER_ENCRYPTION_KEY).toBe('value-MASTER_ENCRYPTION_KEY');
    expect(env.FIREBASE_SERVICE_ACCOUNT).toBe('value-FIREBASE_SERVICE_ACCOUNT');
    // every mapped secret was fetched exactly once
    const secretCalls = fetchImpl.mock.calls.filter(([u]) => String(u).includes('secretmanager'));
    expect(secretCalls.length).toBe(require('../config/platformSecrets').PLATFORM_SECRETS.length);
  });

  it('env wins: an already-set value is never overwritten', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).includes('oauth2.googleapis.com')) return tokenOk();
      return secretPayload('x');
    });
    const env = {
      SECRET_MANAGER_CREDENTIALS: JSON.stringify(makeCredentials()),
      PAYHERE_MERCHANT_ID: 'local-override'
    };

    const result = await loadPlatformSecrets({ env, fetchImpl });

    expect(env.PAYHERE_MERCHANT_ID).toBe('local-override');
    expect(result.injected).not.toContain('PAYHERE_MERCHANT_ID');
    expect(result.skipped).toContain('PAYHERE_MERCHANT_ID');
    expect(env.MASTER_ENCRYPTION_KEY).toBe('value-x');
  });

  it('rejects a malformed credential value', () => {
    expect(() => parseCredentials({ SECRET_MANAGER_CREDENTIALS: 'not-json-not-base64-json' })).toThrow(/service-account JSON/);
    expect(() => parseCredentials({ SECRET_MANAGER_CREDENTIALS: JSON.stringify({ foo: 1 }) })).toThrow(/client_email\/private_key/);
    expect(isConfigured({})).toBe(false);
    expect(isConfigured({ SECRET_MANAGER_CREDENTIALS: 'x' })).toBe(true);
  });

  it('fails fast when the token endpoint is down (after retries)', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    const env = { SECRET_MANAGER_CREDENTIALS: JSON.stringify(makeCredentials()) };

    await expect(loadPlatformSecrets({ env, fetchImpl, maxRetries: 1, retryDelayMs: 0 })).rejects.toThrow(/token request failed/);
    expect(fetchImpl.mock.calls.filter(([u]) => String(u).includes('secretmanager')).length).toBe(0);
  });

  it('fails fast listing the secrets that could not be resolved', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).includes('oauth2.googleapis.com')) return tokenOk();
      return { ok: false, status: 500, json: async () => ({}) };
    });
    const env = { SECRET_MANAGER_CREDENTIALS: JSON.stringify(makeCredentials()) };

    await expect(loadPlatformSecrets({ env, fetchImpl, maxRetries: 0, retryDelayMs: 0 })).rejects.toThrow(/Platform secrets unavailable/);
  });

  it('uses SECRET_MANAGER_PROJECT when provided', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).includes('oauth2.googleapis.com')) return tokenOk();
      return secretPayload('x');
    });
    const env = { SECRET_MANAGER_CREDENTIALS: JSON.stringify(makeCredentials()), SECRET_MANAGER_PROJECT: 'custom-project' };

    await loadPlatformSecrets({ env, fetchImpl, maxRetries: 0 });
    const secretCalls = fetchImpl.mock.calls.filter(([u]) => String(u).includes('secretmanager'));
    expect(secretCalls[0][0]).toContain('/projects/custom-project/secrets/');
  });
});
