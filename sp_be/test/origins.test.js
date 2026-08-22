const { getAllowedOrigins } = require('../utils/origins');

describe('getAllowedOrigins', () => {
  it('parses a comma-separated allow-list and trims entries', () => {
    const env = {
      SOCKET_ALLOWED_ORIGINS: ' https://admin.spots.lk , https://spots.lk ',
      FRONTEND_URL: 'https://spots.lk'
    };
    expect(getAllowedOrigins(env)).toEqual([
      'https://admin.spots.lk',
      'https://spots.lk'
    ]);
  });

  it('drops empty entries between commas', () => {
    const env = { SOCKET_ALLOWED_ORIGINS: 'https://a.lk,,https://b.lk', FRONTEND_URL: 'https://x.lk' };
    expect(getAllowedOrigins(env)).toEqual(['https://a.lk', 'https://b.lk']);
  });

  it('falls back to FRONTEND_URL when the allow-list is unset or blank', () => {
    expect(getAllowedOrigins({ FRONTEND_URL: 'https://spots.lk' })).toEqual(['https://spots.lk']);
    expect(getAllowedOrigins({ SOCKET_ALLOWED_ORIGINS: '  ', FRONTEND_URL: 'https://spots.lk' })).toEqual(['https://spots.lk']);
  });

  it('returns an empty list when neither is configured', () => {
    expect(getAllowedOrigins({})).toEqual([]);
  });
});