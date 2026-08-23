const request = require('supertest');
const app = require('../app');

describe('venue discovery', () => {
  it('lists only approved venues', async () => {
    // Page size default is 20; other suites add venues to the shared test DB,
    // so ask for enough to see every approved venue.
    const res = await request(app).get('/api/v1/venues?limit=100');
    expect(res.status).toBe(200);
    const names = res.body.data.map((v) => v.name);
    expect(names).toContain('Smash Arena');
    expect(names).toContain('Green Turf Colombo');
    expect(res.body.data.every((v) => v.status === 'approved')).toBe(true);
  });

  it('returns sport slugs on every venue for imagery fallback', async () => {
    const res = await request(app).get('/api/v1/venues?limit=100');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const venue of res.body.data) {
      expect(Array.isArray(venue.sports)).toBe(true);
      expect(venue.sports.every((s) => typeof s === 'string')).toBe(true);
    }
    const smash = res.body.data.find((v) => v.name === 'Smash Arena');
    expect(smash.sports).toContain('badminton');
    expect(smash.sports).toContain('futsal');
  });

  it('filters by sport slug', async () => {
    const res = await request(app).get('/api/v1/venues?sport=football');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.every((v) => v.name === 'Green Turf Colombo')).toBe(true);
  });

  it('filters by city and name search', async () => {
    const byCity = await request(app).get('/api/v1/venues?city=Colombo');
    expect(byCity.body.data.length).toBeGreaterThanOrEqual(3);

    const byName = await request(app).get('/api/v1/venues?search=smash');
    expect(byName.body.data.map((v) => v.name)).toEqual(['Smash Arena']);

    const noMatch = await request(app).get('/api/v1/venues?search=zzzz');
    expect(noMatch.body.data).toEqual([]);
  });

  it('filters by price range', async () => {
    const res = await request(app).get('/api/v1/venues?min_price=2000&max_price=5000');
    expect(res.status).toBe(200);
    expect(res.body.data.map((v) => v.name)).toContain('Green Turf Colombo');
    expect(res.body.data.map((v) => v.name)).toContain('Lanka Cricket Nets');
    expect(res.body.data.map((v) => v.name)).not.toContain('Smash Arena');
  });

  it('filters by indoor', async () => {
    const res = await request(app).get('/api/v1/venues?indoor=true&limit=100');
    expect(res.body.data.map((v) => v.name)).toContain('Smash Arena');
    expect(res.body.data.map((v) => v.name)).toContain('Lanka Cricket Nets');
  });

  it('returns venue detail with courts, sports, and hours', async () => {
    const list = await request(app).get('/api/v1/venues?limit=100');
    const smash = list.body.data.find((v) => v.name === 'Smash Arena');

    const res = await request(app).get(`/api/v1/venues/${smash.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Smash Arena');
    expect(res.body.data.courts.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data.courts[0]).toHaveProperty('sport');
    expect(res.body.data.courts[0]).toHaveProperty('price_per_slot');
    expect(res.body.data.sports).toContain('Badminton');
    expect(res.body.data.hours.length).toBeGreaterThan(0);
  });

  it('returns 404 for an unknown venue', async () => {
    const res = await request(app).get('/api/v1/venues/99999999-9999-9999-9999-999999999999');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('VENUE_NOT_FOUND');
  });
});
