const request = require('supertest');
const { SignJWT } = require('jose');
const app = require('../app');
const pool = require('../db');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid, email) =>
  new SignJWT({ uid, email }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

describe('business court management', () => {
  let ownerToken, playerToken;

  beforeAll(async () => {
    ownerToken = await tokenFor('demo-owner-uid');
    playerToken = await tokenFor('demo-player-uid');
  });

  it('owner can list their courts', async () => {
    const res = await request(app)
      .get('/api/v1/business/courts')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(7);
    expect(res.body.data[0]).toHaveProperty('venue_id');
    expect(res.body.data[0]).toHaveProperty('price_per_slot');
  });

  it('players are rejected from business endpoints', async () => {
    const res = await request(app)
      .get('/api/v1/business/courts')
      .set('Authorization', `Bearer ${playerToken}`);
    expect(res.status).toBe(403);
  });

  it('owner can add a court to one of their venues', async () => {
    const res = await request(app)
      .post('/api/v1/business/courts')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        venue_id: '11111111-1111-1111-1111-111111111111',
        name: 'Court 3',
        sport: 'badminton',
        price_per_slot: 1600,
        slot_duration_min: 60,
        capacity: 4,
        is_indoor: true
      });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Court 3');
    expect(res.body.data.price_per_slot).toBe(1600);
  });

  it('owner cannot add a court to a venue they do not own', async () => {
    const { rows } = await pool.query(
      `insert into venues (owner_id, business_id, name, city, address, status)
       select id,
              (select b.id from businesses b join users o on o.id = b.owner_id where o.firebase_uid = 'demo-owner-uid'),
              'Foreign Venue', 'Kandy', '1 Kandy St', 'approved'
       from users where firebase_uid = 'demo-player-uid'
       returning id`
    );
    const foreignVenueId = rows[0].id;

    const res = await request(app)
      .post('/api/v1/business/courts')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        venue_id: foreignVenueId,
        name: 'Hacked Court',
        sport: 'badminton',
        price_per_slot: 100
      });
    expect(res.status).toBe(403);
  });

  it('owner can update a court', async () => {
    const res = await request(app)
      .patch('/api/v1/business/courts/aaaaaaaa-0000-0000-0000-000000000001')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ price_per_slot: 1800, name: 'Court 1 (Renamed)' });
    expect(res.status).toBe(200);
    expect(res.body.data.price_per_slot).toBe(1800);
  });

  it('owner can archive a court and it leaves the public venue view', async () => {
    const archive = await request(app)
      .patch('/api/v1/business/courts/aaaaaaaa-0000-0000-0000-000000000003')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ is_active: false });
    expect(archive.status).toBe(200);
    expect(archive.body.data.is_active).toBe(false);

    const detail = await request(app).get('/api/v1/venues/11111111-1111-1111-1111-111111111111');
    const names = detail.body.data.courts.map((c) => c.name);
    expect(names).not.toContain('Table 1');
  });

  it('owner can set venue hours', async () => {
    const res = await request(app)
      .put('/api/v1/business/venues/11111111-1111-1111-1111-111111111111/hours')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        hours: [
          { day_of_week: 0, open_time: '08:00', close_time: '20:00' },
          { day_of_week: 1, open_time: '08:00', close_time: '20:00' }
        ]
      });
    expect(res.status).toBe(200);
    expect(res.body.data.hours).toHaveLength(2);

    const detail = await request(app).get('/api/v1/venues/11111111-1111-1111-1111-111111111111');
    expect(detail.body.data.hours).toHaveLength(2);

    await request(app)
      .put('/api/v1/business/venues/11111111-1111-1111-1111-111111111111/hours')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        hours: Array.from({ length: 7 }, (_, d) => ({ day_of_week: d, open_time: '06:00', close_time: '23:00' }))
      });
  });

  it('owner can block and unblock a slot on a court', async () => {
    const start = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString();
    const end = new Date(Date.now() + 2 * 24 * 3600 * 1000 + 3600 * 1000).toISOString();

    const created = await request(app)
      .post('/api/v1/business/courts/aaaaaaaa-0000-0000-0000-000000000001/blocks')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ start_at: start, end_at: end, reason: 'Maintenance' });
    expect(created.status).toBe(201);

    const list = await request(app)
      .get('/api/v1/business/courts/aaaaaaaa-0000-0000-0000-000000000001/blocks')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(list.body.data.length).toBe(1);
    expect(list.body.data[0].reason).toBe('Maintenance');

    const removed = await request(app)
      .delete(`/api/v1/business/courts/aaaaaaaa-0000-0000-0000-000000000001/blocks/${created.body.data.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(removed.status).toBe(200);

    const after = await request(app)
      .get('/api/v1/business/courts/aaaaaaaa-0000-0000-0000-000000000001/blocks')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(after.body.data).toEqual([]);
  });
});
