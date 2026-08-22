const { requestBaseUrl } = require('../utils/tokens');

describe('requestBaseUrl host trust', () => {
  it('never derives the base from the request Host header', () => {
    const req = { get: () => 'evil.example', protocol: 'https' };
    const base = requestBaseUrl(req);
    expect(base).not.toMatch(/evil\.example/);
  });

  it('returns the configured frontend origin', () => {
    const req = { get: () => 'evil.example', protocol: 'https' };
    expect(requestBaseUrl(req)).toBe(process.env.FRONTEND_URL || undefined);
  });
});