// AES-256-GCM encryption at rest for per-Business PayHere credentials
// (utils/encryption.js, ADR-0044). The key is MASTER_ENCRYPTION_KEY in every
// non-test environment (required at boot, ADR-0046) and a fixed dev key in
// tests; the old fallback chain was removed so production can never encrypt
// owner credentials under a non-master key.

const crypto = require('node:crypto');
const { encryptSecret, decryptSecret, maskLast4 } = require('../utils/encryption');

describe('encryption at rest (ADR-0044/0046)', () => {
  it('round-trips a secret under the test key and never stores plaintext', () => {
    const secret = 'merchant-secret-9f8e';
    const enc = encryptSecret(secret);
    expect(enc).toMatch(/^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/); // iv:tag:ciphertext
    expect(enc).not.toContain(secret);
    expect(decryptSecret(enc)).toBe(secret);
  });

  it('returns null for tampered or malformed ciphertext', () => {
    const enc = encryptSecret('abc123');
    expect(decryptSecret(enc.slice(0, -4) + 'ffff')).toBeNull();
    expect(decryptSecret('garbage')).toBeNull();
    expect(decryptSecret('')).toBeNull();
    expect(decryptSecret(null)).toBeNull();
  });

  it('masks secrets to the last four characters', () => {
    expect(maskLast4('1234567890')).toBe('••••7890');
    expect(maskLast4('1234')).toBe('••••');
    expect(maskLast4('')).toBe('••••');
    expect(maskLast4(null)).toBe('••••');
  });

  it('never reads the fallback chain in tests (key is deterministic under test)', () => {
    // Two encryptions of the same value must decrypt under the same key, and
    // the test key must not depend on OTP/JWT env that the suite may set.
    const before = { ...process.env };
    delete process.env.TOTP_ENCRYPTION_KEY;
    delete process.env.OTP_HMAC_SECRET;
    delete process.env.JWT_SECRET;
    const enc = encryptSecret('deterministic');
    expect(decryptSecret(enc)).toBe('deterministic');
    Object.assign(process.env, before);
  });

  it('uses the master key outside test (round-trip symmetric under the same key)', () => {
    const key = crypto.randomBytes(32).toString('hex');
    const prev = process.env.NODE_ENV;
    const prevKey = process.env.MASTER_ENCRYPTION_KEY;
    process.env.NODE_ENV = 'production';
    process.env.MASTER_ENCRYPTION_KEY = key;
    try {
      const enc = encryptSecret('prod-secret');
      expect(decryptSecret(enc)).toBe('prod-secret');
      // A different key must not decrypt the same ciphertext.
      process.env.MASTER_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
      expect(decryptSecret(enc)).toBeNull();
    } finally {
      process.env.NODE_ENV = prev;
      if (prevKey === undefined) delete process.env.MASTER_ENCRYPTION_KEY;
      else process.env.MASTER_ENCRYPTION_KEY = prevKey;
    }
  });
});
