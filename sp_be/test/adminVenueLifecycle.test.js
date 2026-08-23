const request = require('supertest');
const { SignJWT } = require('jose');
const app = require('../app');
const pool = require('../db');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid) =>
  new SignJWT({ uid }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

let OWNER_TOKEN;
let ADMIN_TOKEN;

async function createVenue(name, ownerToken = OWNER_TOKEN) {
  const res = await request(app)
    .post('/api/v1/venues')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      name,
      address: '6 Test Ave',
      city: 'Colombo',
      sports: ['badminton'],
      courts: [{ name: 'C', sport: 'badminton', price_per_slot: 1000, slot_duration_min: 60, capacity: 2, is_indoor: true }],
      hours: Array.from({ length: 7 }, (_, d) => ({ day_of_week: d, open_time: '06:00', close_time: '23:00' }))
    });
  return res.body.data.id;
}

describe('admin venue lifecycle', () => {
  beforeAll(async () => {
    OWNER_TOKEN = await tokenFor('demo-owner-uid');
    ADMIN_TOKEN = await tokenFor('demo-admin-uid');
  });

  it('suspends an approved venue (hidden + not bookable) and unsuspends', async () => {
    const id = await createVenue('Suspend Venue');
    await request(app).post(`/api/v1/admin/venues/${id}/approve`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    const suspend = await request(app)
      .post(`/api/v1/admin/venues/${id}/suspend`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ reason: 'Complaint under review' });
    expect(suspend.status).toBe(200);
    expect(suspend.body.data.status).toBe('suspended');

    const avail = await request(app).get(`/api/v1/venues/${id}/availability?date=2026-08-22`);
    expect(avail.status).toBe(404);

    const list = await request(app).get('/api/v1/venues?city=Colombo');
    expect(list.body.data.find((v) => v.id === id)).toBeUndefined();

    const unsuspend = await request(app)
      .post(`/api/v1/admin/venues/${id}/unsuspend`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(unsuspend.status).toBe(200);
    expect(unsuspend.body.data.status).toBe('approved');
  });

  it('archives a venue (soft delete, hidden)', async () => {
    const id = await createVenue('Archive Venue');
    await request(app).post(`/api/v1/admin/venues/${id}/approve`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    const archive = await request(app)
      .post(`/api/v1/admin/venues/${id}/archive`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(archive.status).toBe(200);
    expect(archive.body.data.status).toBe('archived');

    const list = await request(app).get('/api/v1/venues?city=Colombo');
    expect(list.body.data.find((v) => v.id === id)).toBeUndefined();
  });

  it('banning an owner revokes console access and unbookables their venues', async () => {
    // Use a dedicated owner so the ban doesn't poison demo-owner for other files.
    const BAN_OWNER_TOKEN = await tokenFor('ban-owner-uid');
    // The ban target is a provisioned owner (ADR-0022) — already onboarded.
    await pool.query(
      `insert into users (firebase_uid, email, name, role, status, onboarding_state)
       values ('ban-owner-uid', 'ban-owner@example.com', 'Ban Owner', 'venue_owner', 'active', 'accepted')
       on conflict (firebase_uid) do update set onboarding_state = 'accepted'`
    );
    const id = await createVenue('Ban Venue', BAN_OWNER_TOKEN);
    const secondId = await createVenue('Ban Venue 2', BAN_OWNER_TOKEN);
    await request(app).post(`/api/v1/admin/venues/${id}/approve`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    await request(app).post(`/api/v1/admin/venues/${secondId}/approve`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    const ban = await request(app)
      .post(`/api/v1/admin/venues/${id}/ban`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ reason: 'Fraudulent bookings' });
    expect(ban.status).toBe(200);
    expect(ban.body.data.status).toBe('banned');

    const { rows } = await pool.query(
      `select status from users where firebase_uid = 'ban-owner-uid'`
    );
    expect(rows[0].status).toBe('banned');

    // every venue of the owner is banned, not just the one acted on
    const { rows: venues } = await pool.query(
      `select status from venues where id = any($1)`,
      [[id, secondId]]
    );
    expect(venues.map((v) => v.status).sort()).toEqual(['banned', 'banned']);

    const biz = await request(app)
      .get('/api/v1/business/overview')
      .set('Authorization', `Bearer ${BAN_OWNER_TOKEN}`);
    expect(biz.status).toBe(403);

    const avail = await request(app).get(`/api/v1/venues/${id}/availability?date=2026-08-22`);
    expect(avail.status).toBe(404);
  });

  it('reject sets changes_requested; owner can resubmit and be approved', async () => {
    const id = await createVenue('Resubmit Venue');

    const reject = await request(app)
      .post(`/api/v1/admin/venues/${id}/reject`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ reason: 'Missing documents' });
    expect(reject.status).toBe(200);
    expect(reject.body.data.status).toBe('changes_requested');
    expect(reject.body.data.rejection_reason).toBe('Missing documents');

    const update = await request(app)
      .patch(`/api/v1/venues/${id}`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ description: 'Now complete with docs.' });
    expect(update.status).toBe(200);

    const resubmit = await request(app)
      .post(`/api/v1/venues/${id}/resubmit`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);
    expect(resubmit.status).toBe(200);
    expect(resubmit.body.data.status).toBe('pending');

    const approve = await request(app)
      .post(`/api/v1/admin/venues/${id}/approve`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(approve.status).toBe(200);
    expect(approve.body.data.status).toBe('approved');
  });

  it('records audit rows for every admin action', async () => {
    const id = await createVenue('Audit Venue');
    await request(app).post(`/api/v1/admin/venues/${id}/approve`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    await request(app).post(`/api/v1/admin/venues/${id}/suspend`).set('Authorization', `Bearer ${ADMIN_TOKEN}`).send({ reason: 'test' });
    await request(app).post(`/api/v1/admin/venues/${id}/unsuspend`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    const audit = await request(app)
      .get(`/api/v1/admin/venues/${id}/audit`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(audit.status).toBe(200);
    const actions = audit.body.data.map((a) => a.action);
    expect(actions).toContain('approved');
    expect(actions).toContain('suspended');
    expect(actions).toContain('unsuspended');
  });

  it('admin can list all venues with owner info', async () => {
    const id = await createVenue('List All Venue');
    await request(app).post(`/api/v1/admin/venues/${id}/approve`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    const list = await request(app)
      .get('/api/v1/admin/venues')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(list.status).toBe(200);
    const found = list.body.data.find((v) => v.id === id);
    expect(found).toBeTruthy();
    expect(found.owner_name).toBe('Demo Owner');
  });
});