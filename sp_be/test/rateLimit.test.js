const express = require('express');
const request = require('supertest');
const { makeRateLimiter } = require('../middleware/rateLimit');

function buildApp(limiter) {
  const app = express();
  app.use(limiter);
  app.get('/', (req, res) => res.json({ ok: true }));
  return app;
}

describe('rate limiting', () => {
  it('rejects requests past the limit with 429 RATE_LIMITED', async () => {
    const app = buildApp(makeRateLimiter({ windowMs: 60000, limit: 3, force: true }));
    for (let i = 0; i < 3; i++) {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
    }
    const blocked = await request(app).get('/');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.headers['retry-after']).toBeTruthy();
  });

  it('is a no-op pass-through under NODE_ENV=test', async () => {
    const app = buildApp(makeRateLimiter({ windowMs: 60000, limit: 1 }));
    const first = await request(app).get('/');
    const second = await request(app).get('/');
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });
});