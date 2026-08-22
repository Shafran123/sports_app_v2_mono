const request = require('supertest');
const { SignJWT } = require('jose');
const app = require('../app');
const pool = require('../db');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid) =>
  new SignJWT({ uid }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

let PLAYER_TOKEN;
let ADMIN_TOKEN;

describe('admin players', () => {
  beforeAll(async () => {
    PLAYER_TOKEN = await tokenFor('demo-player-uid');
    ADMIN_TOKEN = await tokenFor('demo-admin-uid');
  });
  it('rejects a player listing the console', async () => {
    const res = await request(app)
      .get('/api/v1/admin/players')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`);
    expect(res.status).toBe(403);
  });

  it('lists players with verified status', async () => {
    const { rows } = await pool.query(`select id, phone_verified_at from users where firebase_uid = 'demo-player-uid'`);
    const playerId = rows[0].id;

    const res = await request(app)
      .get('/api/v1/admin/players')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    const listed = res.body.data.find((u) => u.id === playerId);
    expect(listed).toBeDefined();
    expect(listed).toHaveProperty('phone_verified_at');
  });

  it('filters players by search term', async () => {
    const res = await request(app)
      .get('/api/v1/admin/players')
      .query({ search: 'zxqv-not-a-real-user-999' })
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(0);
  });
});