const request = require('supertest');
const { SignJWT } = require('jose');
const app = require('../app');

const secret = new TextEncoder().encode('test-secret');

function tokenFor(uid, email, phoneNumber) {
  return new SignJWT({ uid, email, ...(phoneNumber ? { phone_number: phoneNumber } : {}) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(secret);
}

const UID = `phone-otp-${Date.now()}`;

describe('phone auth — users.phone from the Firebase token', () => {
  it('records the phone_number claim on a first OTP sign-in', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${await tokenFor(UID, null, '+94712345678')}`);

    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe('+94712345678');
  });

  it('keeps the phone when a later sign-in (email) has no phone claim', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${await tokenFor(UID, 'later@spots.lk')}`);

    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe('+94712345678');
  });
});