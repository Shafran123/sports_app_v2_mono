const request = require('supertest');
const { SignJWT } = require('jose');
const app = require('../app');

const secret = new TextEncoder().encode('test-secret');

function tokenFor(uid, email) {
  return new SignJWT({ uid, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(secret);
}

describe('auth', () => {
  it('rejects requests without a token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects malformed tokens', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer not-a-token');
    expect(res.status).toBe(401);
  });

  it('upserts the user and returns the profile', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${await tokenFor('brand-new-uid', 'new@spots.lk')}`);

    expect(res.status).toBe(200);
    expect(res.body.data.firebase_uid).toBe('brand-new-uid');
    expect(res.body.data.email).toBe('new@spots.lk');
    expect(res.body.data.role).toBe('player');

    const again = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${await tokenFor('brand-new-uid', 'new@spots.lk')}`);
    expect(again.body.data.id).toBe(res.body.data.id);
  });

  it('resolves the seeded demo users with their roles', async () => {
    const player = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${await tokenFor('demo-player-uid')}`);
    expect(player.body.data.role).toBe('player');

    const admin = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${await tokenFor('demo-admin-uid')}`);
    expect(admin.body.data.role).toBe('admin');
  });

  it('lets a user update name, phone, and city', async () => {
    const res = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${await tokenFor('demo-player-uid')}`)
      .send({ name: 'Updated Name', phone: '0770000000', city: 'Galle' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Name');
    expect(res.body.data.city).toBe('Galle');
  });

  it('ignores fields that are not part of the profile', async () => {
    const res = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${await tokenFor('demo-player-uid')}`)
      .send({ name: 'Keep', role: 'admin' });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('player');
  });

  it('rejects a player calling an admin route', async () => {
    const res = await request(app)
      .get('/api/v1/admin/venues/pending')
      .set('Authorization', `Bearer ${await tokenFor('demo-player-uid')}`);

    expect(res.status).toBe(403);
  });

  it('allows an admin to call an admin route', async () => {
    const res = await request(app)
      .get('/api/v1/admin/venues/pending')
      .set('Authorization', `Bearer ${await tokenFor('demo-admin-uid')}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
