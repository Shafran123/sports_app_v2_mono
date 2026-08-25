const request = require('supertest');
const { SignJWT } = require('jose');
const app = require('../app');
const pool = require('../db');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid) =>
  new SignJWT({ uid, email: `${uid}@myslot.test`, email_verified: true }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

describe('events', () => {
  let ownerToken, adminToken, playerToken;

  beforeAll(async () => {
    ownerToken = await tokenFor('demo-owner-uid');
    adminToken = await tokenFor('demo-admin-uid');
    playerToken = await tokenFor('demo-player-uid');
  });

  async function createEvent(overrides = {}) {
    const start = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString();
    const res = await request(app)
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Test Tournament Night',
        sport: 'badminton',
        start_at: start,
        city: 'Colombo',
        capacity: 2,
        price: 1000,
        ...overrides
      });
    expect(res.status).toBe(201);
    return res.body.data;
  }

  it('lists and fetches events publicly', async () => {
    const event = await createEvent();

    const list = await request(app).get('/api/v1/events?city=Colombo');
    expect(list.status).toBe(200);
    expect(list.body.data.map((e) => e.id)).toContain(event.id);

    const detail = await request(app).get(`/api/v1/events/${event.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.name).toBe('Test Tournament Night');
  });

  it('registers a player and creates a pending payment', async () => {
    const event = await createEvent({ name: 'Reg Event' });

    const res = await request(app)
      .post(`/api/v1/events/${event.id}/register`)
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ idempotency_key: 'reg-1' });

    expect(res.status).toBe(201);
    expect(res.body.data.registration_id).toBeTruthy();
    expect(res.body.data.amount).toBe(1000);

    const { rows } = await pool.query(
      `select status from payments where event_registration_id = $1`,
      [res.body.data.registration_id]
    );
    expect(rows[0].status).toBe('pending');
  });

  it('prevents duplicate registration', async () => {
    const event = await createEvent({ name: 'Dup Event' });
    await request(app)
      .post(`/api/v1/events/${event.id}/register`)
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ idempotency_key: 'reg-dup-1' });

    const res = await request(app)
      .post(`/api/v1/events/${event.id}/register`)
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ idempotency_key: 'reg-dup-2' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_REGISTERED');
  });

  it('enforces capacity', async () => {
    const event = await createEvent({ name: 'Cap Event', capacity: 1 });

    await request(app)
      .post(`/api/v1/events/${event.id}/register`)
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ idempotency_key: 'cap-1' });

    const secondToken = await tokenFor('other-player-uid');
    const res = await request(app)
      .post(`/api/v1/events/${event.id}/register`)
      .set('Authorization', `Bearer ${secondToken}`)
      .send({ idempotency_key: 'cap-2' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EVENT_FULL');
  });

  it('organizer cancels the event and registrations are refunded', async () => {
    const event = await createEvent({ name: 'Cancel Event' });
    const reg = await request(app)
      .post(`/api/v1/events/${event.id}/register`)
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ idempotency_key: 'cancel-event-reg' });

    const res = await request(app)
      .post(`/api/v1/events/${event.id}/cancel`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);

    const { rows } = await pool.query(
      `select status from event_registrations where id = $1`,
      [reg.body.data.registration_id]
    );
    expect(rows[0].status).toBe('refunded');

    const detail = await request(app).get(`/api/v1/events/${event.id}`);
    expect(detail.body.data.status).toBe('cancelled');
  });

  it('only the organizer can cancel', async () => {
    const event = await createEvent({ name: 'No Cancel Event' });

    const res = await request(app)
      .post(`/api/v1/events/${event.id}/cancel`)
      .set('Authorization', `Bearer ${playerToken}`);
    expect(res.status).toBe(403);
  });
});
