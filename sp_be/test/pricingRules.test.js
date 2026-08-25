const request = require('supertest');
const { SignJWT } = require('jose');
const app = require('../app');
const pool = require('../db');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid) =>
  new SignJWT({ uid }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

async function createVenue(name) {
  const ownerToken = await tokenFor('demo-owner-uid');
  const adminToken = await tokenFor('demo-admin-uid');
  const created = await request(app)
    .post('/api/v1/venues')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      name,
      address: '1 Pricing Ave',
      city: 'Colombo',
      sports: ['badminton'],
      courts: [{ name: 'Price Court', sport: 'badminton', price_per_slot: 1500, slot_duration_min: 60 }],
      hours: Array.from({ length: 7 }, (_, d) => ({ day_of_week: d, open_time: '06:00', close_time: '23:00' }))
    });
  await request(app)
    .post(`/api/v1/admin/venues/${created.body.data.id}/approve`)
    .set('Authorization', `Bearer ${adminToken}`);
  const { rows } = await pool.query(`select id from courts where venue_id = $1`, [created.body.data.id]);
  return { venueId: created.body.data.id, courtId: rows[0].id };
}

describe('whole-schedule pricing replacement', () => {
  it('replaces a court pricing schedule in one call', async () => {
    const ownerToken = await tokenFor('demo-owner-uid');
    const { courtId } = await createVenue('Replace Pricing Venue');
    const res = await request(app)
      .put(`/api/v1/business/courts/${courtId}/pricing`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        rules: [
          { day_of_week: 1, start_time: '18:00', end_time: '21:00', price_per_slot: 2000 },
          { day_of_week: 5, start_time: '09:00', end_time: '12:00', price_per_slot: 1800 },
          { day_of_week: 5, start_time: '12:00', end_time: '15:00', price_per_slot: 2000 }
        ]
      });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);

    const list = await request(app)
      .get(`/api/v1/business/courts/${courtId}/pricing`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(list.body.data).toHaveLength(3);
    expect(list.body.data.find((r) => r.day_of_week === 1)).toMatchObject({ price_per_slot: 2000 });
  });

  it('an empty schedule deletes all rules and returns the court to its base price', async () => {
    const ownerToken = await tokenFor('demo-owner-uid');
    const { courtId } = await createVenue('Empty Pricing Venue');
    await request(app)
      .put(`/api/v1/business/courts/${courtId}/pricing`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ rules: [{ day_of_week: 2, start_time: '06:00', end_time: '09:00', price_per_slot: 3000 }] });

    const cleared = await request(app)
      .put(`/api/v1/business/courts/${courtId}/pricing`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ rules: [] });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data).toEqual([]);
  });

  it('rejects a window that does not fit inside opening hours', async () => {
    const ownerToken = await tokenFor('demo-owner-uid');
    const { courtId } = await createVenue('Bad Window Pricing Venue');
    const res = await request(app)
      .put(`/api/v1/business/courts/${courtId}/pricing`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ rules: [{ day_of_week: 0, start_time: '03:00', end_time: '05:00', price_per_slot: 1000 }] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PRICING_VALIDATION');
  });

  it('rejects non-owners, non-arrays, and invalid rules', async () => {
    const ownerToken = await tokenFor('demo-owner-uid');
    const { courtId } = await createVenue('Owner Guard Pricing Venue');
    const playerToken = await tokenFor('demo-player-uid');

    const forbidden = await request(app)
      .put(`/api/v1/business/courts/${courtId}/pricing`)
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ rules: [] });
    expect(forbidden.status).toBe(403);

    const notArray = await request(app)
      .put(`/api/v1/business/courts/${courtId}/pricing`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ rules: 'nope' });
    expect(notArray.status).toBe(400);

    const badDay = await request(app)
      .put(`/api/v1/business/courts/${courtId}/pricing`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ rules: [{ day_of_week: 99, start_time: '06:00', end_time: '09:00', price_per_slot: 1000 }] });
    expect(badDay.status).toBe(400);

    const badPrice = await request(app)
      .put(`/api/v1/business/courts/${courtId}/pricing`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ rules: [{ day_of_week: 0, start_time: '06:00', end_time: '09:00', price_per_slot: -5 }] });
    expect(badPrice.status).toBe(400);
  });
});