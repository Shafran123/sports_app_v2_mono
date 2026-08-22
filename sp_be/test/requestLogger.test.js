const { redactSensitiveData } = require('../middleware/requestLogger');

describe('request logger redaction', () => {
  it('redacts codes, otps, tokens, passwords, keys, and phones', () => {
    const payload = {
      phone: '+94771234567',
      code: '123456',
      fcm_token: 'fcm-abc',
      password: 'hunter2',
      idempotency_key: 'k-1',
      api_key: 'secret-key',
      authorization: 'Bearer xxx',
      name: 'Demo Player',
      city: 'Colombo'
    };
    const redacted = redactSensitiveData(payload);
    const raw = JSON.stringify(redacted);

    expect(raw).not.toContain('123456');
    expect(raw).not.toContain('hunter2');
    expect(raw).not.toContain('k-1');
    expect(raw).not.toContain('secret-key');
    expect(raw).not.toContain('Bearer xxx');
    expect(raw).not.toContain('+94771234567');
    expect(redacted.code).toBe('[REDACTED]');
    expect(redacted.phone).not.toBe('+94771234567');
    expect(redacted.name).toBe('Demo Player');
    expect(redacted.city).toBe('Colombo');
  });

  it('redacts nested fields, not whole nested objects', () => {
    const payload = { user: { phone: '+94770000000', name: 'A' }, meta: { otp: '000000' }, note: 'code is fine here' };
    const redacted = redactSensitiveData(payload);
    const raw = JSON.stringify(redacted);
    expect(raw).not.toContain('+94770000000');
    expect(raw).not.toContain('000000');
    expect(raw).toContain('code is fine here');
    expect(redacted.user.name).toBe('A');
  });
});