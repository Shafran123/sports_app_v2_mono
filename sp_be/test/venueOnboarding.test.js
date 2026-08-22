const request = require('supertest');
const { SignJWT } = require('jose');
const app = require('../app');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid, email) =>
  new SignJWT({ uid, email }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

const validVenue = {
  name: 'Test Racket Club',
  description: 'A test venue',
  address: '1 Test Street',
  city: 'Galle',
  phone: '0912223333',
  sports: ['badminton'],
  courts: [
    { name: 'Court A', sport: 'badminton', price_per_slot: 1200, slot_duration_min: 60, capacity: 4, is_indoor: true }
  ],
  hours: [{ day_of_week: 0, open_time: '06:00', close_time: '22:00' }]
};

describe('venue onboarding', () => {
  let ownerToken, newOwnerToken, adminToken, playerToken;

  beforeAll(async () => {
    ownerToken = await tokenFor('demo-owner-uid');
    newOwnerToken = await tokenFor('fresh-owner-uid', 'fresh@spots.lk');
    adminToken = await tokenFor('demo-admin-uid');
    playerToken = await tokenFor('demo-player-uid');
  });

  it('owner can submit a venue and it starts pending', async () => {
    const res = await request(app)
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(validVenue);

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.name).toBe('Test Racket Club');
    expect(res.body.data.courts).toHaveLength(1);
  });

  it('a pending venue is invisible in public discovery', async () => {
    const res = await request(app).get('/api/v1/venues?search=Test Racket');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('a player can submit a venue (that is how one becomes an owner)', async () => {
    const res = await request(app)
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ ...validVenue, name: 'Player To Owner Club' });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
  });

  it('rejects a venue submission without courts', async () => {
    const res = await request(app)
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ ...validVenue, name: 'No Courts Club', courts: [] });
    expect(res.status).toBe(400);
  });

  it('owner sees their venues with status', async () => {
    const res = await request(app)
      .get('/api/v1/venues/mine')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    const names = res.body.data.map((v) => v.name);
    expect(names).toContain('Test Racket Club');
    expect(names).toContain('Smash Arena');
  });

  it('admin lists pending venues', async () => {
    const res = await request(app)
      .get('/api/v1/admin/venues/pending')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((v) => v.name)).toContain('Test Racket Club');
  });

  it('admin approves a venue and the owner becomes venue_owner', async () => {
    const submitted = await request(app)
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${newOwnerToken}`)
      .send({ ...validVenue, name: 'Fresh Owner Club' });

    const id = submitted.body.data.id;

    const approve = await request(app)
      .post(`/api/v1/admin/venues/${id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(approve.status).toBe(200);
    expect(approve.body.data.status).toBe('approved');

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${newOwnerToken}`);
    expect(me.body.data.role).toBe('venue_owner');

    const found = await request(app).get('/api/v1/venues?search=Fresh Owner');
    expect(found.body.data.map((v) => v.name)).toContain('Fresh Owner Club');
  });

  it('admin rejects a venue with a reason', async () => {
    const submitted = await request(app)
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ ...validVenue, name: 'Reject Me Club' });

    const id = submitted.body.data.id;

    const res = await request(app)
      .post(`/api/v1/admin/venues/${id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Incomplete documents' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('changes_requested');
    expect(res.body.data.rejection_reason).toBe('Incomplete documents');
  });

  it('non-admin cannot approve venues', async () => {
    const submitted = await request(app)
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ ...validVenue, name: 'Another Club' });

    const res = await request(app)
      .post(`/api/v1/admin/venues/${submitted.body.data.id}/approve`)
      .set('Authorization', `Bearer ${playerToken}`);
    expect(res.status).toBe(403);
  });

  it('approving a non-pending venue fails', async () => {
    const approved = await request(app)
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${newOwnerToken}`)
      .send({ ...validVenue, name: 'Pre Approved Club' });
    const id = approved.body.data.id;

    await request(app)
      .post(`/api/v1/admin/venues/${id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    const again = await request(app)
      .post(`/api/v1/admin/venues/${id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(again.status).toBe(400);
  });
});
