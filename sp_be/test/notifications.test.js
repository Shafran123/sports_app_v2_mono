const request = require('supertest');
const { SignJWT } = require('jose');
const app = require('../app');
const pool = require('../db');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid) =>
  new SignJWT({ uid }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

describe('notifications', () => {
  it('lists notifications for the user and marks them read', async () => {
    const playerToken = await tokenFor('demo-player-uid');
    const { rows: userRows } = await pool.query(
      `select id from users where firebase_uid = 'demo-player-uid'`
    );
    const userId = userRows[0].id;

    await pool.query(
      `insert into notifications (user_id, type, title, body) values ($1, 'test', 'Test', 'Body')`,
      [userId]
    );

    const list = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${playerToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThanOrEqual(1);

    const notif = list.body.data[0];
    const read = await request(app)
      .patch(`/api/v1/notifications/${notif.id}/read`)
      .set('Authorization', `Bearer ${playerToken}`);
    expect(read.status).toBe(200);
    expect(read.body.data.is_read).toBe(true);
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(app).get('/api/v1/notifications');
    expect(res.status).toBe(401);
  });
});
