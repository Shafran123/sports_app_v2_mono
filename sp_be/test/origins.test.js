const { getEnvOrigins, getAllowedOrigins, corsOrigin } = require('../utils/origins');
const pool = require('../db');

describe('getEnvOrigins', () => {
  it('parses a comma-separated allow-list and trims entries', () => {
    const env = {
      SOCKET_ALLOWED_ORIGINS: ' https://admin.spots.lk , https://spots.lk ',
      FRONTEND_URL: 'https://spots.lk'
    };
    expect(getEnvOrigins(env)).toEqual([
      'https://admin.spots.lk',
      'https://spots.lk'
    ]);
  });

  it('drops empty entries between commas', () => {
    const env = { SOCKET_ALLOWED_ORIGINS: 'https://a.lk,,https://b.lk', FRONTEND_URL: 'https://x.lk' };
    expect(getEnvOrigins(env)).toEqual(['https://a.lk', 'https://b.lk']);
  });

  it('falls back to FRONTEND_URL when the allow-list is unset or blank', () => {
    expect(getEnvOrigins({ FRONTEND_URL: 'https://spots.lk' })).toEqual(['https://spots.lk']);
    expect(getEnvOrigins({ SOCKET_ALLOWED_ORIGINS: '  ', FRONTEND_URL: 'https://spots.lk' })).toEqual(['https://spots.lk']);
  });

  it('returns an empty list when neither is configured', () => {
    expect(getEnvOrigins({})).toEqual([]);
  });
});

describe('getAllowedOrigins (DB-driven, ADR-0029)', () => {
  it('returns env origins when no live site hostnames exist', async () => {
    await pool.query(`delete from site_domain_requests`);
    const origins = await getAllowedOrigins({ FRONTEND_URL: 'https://spots.lk' });
    expect(origins).toContain('https://spots.lk');
  });

  it('appends live site hostnames and their apex/www twins', async () => {
    await pool.query(
      `insert into site_domain_requests (business_id, hostname, hostname_kind, status, dns_type, dns_name, dns_value)
       values (
         (select id from businesses order by created_at limit 1),
         'abc.lk', 'custom', 'live', 'TXT', 'abc.lk', 'myslot-site-verification=deadbeef'
       )`
    );
    const origins = await getAllowedOrigins({ FRONTEND_URL: 'https://spots.lk' });
    expect(origins).toContain('abc.lk');
    expect(origins).toContain('www.abc.lk');
    expect(origins).toContain('https://spots.lk');
  });
});

describe('corsOrigin', () => {
  it('admits an exact live site origin and denies a stranger origin', async () => {
    const origin = corsOrigin({ FRONTEND_URL: 'https://spots.lk' });
    await new Promise((resolve, reject) => {
      origin('https://abc.lk', (err, allowed) => {
        try {
          expect(err).toBeNull();
          expect(allowed).toBe(true);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
    await new Promise((resolve, reject) => {
      origin('https://evil.lk', (err, allowed) => {
        try {
          expect(allowed).toBe(false);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
  });
});