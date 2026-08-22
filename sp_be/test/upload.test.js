const request = require('supertest');
const { SignJWT } = require('jose');
const fs = require('fs');
const path = require('path');
const app = require('../app');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid) =>
  new SignJWT({ uid }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

describe('image upload', () => {
  let ownerToken;
  beforeAll(async () => {
    ownerToken = await tokenFor('demo-owner-uid');
  });

  it('stores an uploaded image and returns a URL', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    );
    const res = await request(app)
      .post('/api/v1/uploads')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ filename: 'photo.png', data: png.toString('base64') });

    expect(res.status).toBe(201);
    expect(res.body.data.url).toMatch(/^\/uploads\/[a-f0-9-]+\.png$/);

    const filePath = path.join(UPLOADS_DIR, path.basename(res.body.data.url));
    expect(fs.existsSync(filePath)).toBe(true);
    fs.unlinkSync(filePath);
  });

  it('rejects a non-image extension', async () => {
    const res = await request(app)
      .post('/api/v1/uploads')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ filename: 'evil.sh', data: Buffer.from('#!/bin/sh').toString('base64') });
    expect(res.status).toBe(400);
  });

  it('requires auth', async () => {
    const res = await request(app)
      .post('/api/v1/uploads')
      .send({ filename: 'photo.png', data: 'abc' });
    expect(res.status).toBe(401);
  });

  it('rejects text disguised as a PNG (magic-byte validation)', async () => {
    const res = await request(app)
      .post('/api/v1/uploads')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ filename: 'photo.png', data: Buffer.from('hello, definitely not an image').toString('base64') });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('UPLOAD_INVALID_IMAGE');
  });

  it('rejects a jpg whose bytes are actually a png (extension/content mismatch)', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    );
    const res = await request(app)
      .post('/api/v1/uploads')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ filename: 'photo.jpg', data: png.toString('base64') });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('UPLOAD_INVALID_IMAGE');
  });

  it('returns a clean 413 (not a 500) for an oversized body', async () => {
    const big = Buffer.alloc(9 * 1024 * 1024, 0x89, 'utf8');
    const res = await request(app)
      .post('/api/v1/uploads')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ filename: 'big.png', data: big.toString('base64') });
    expect([413, 400]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });

  it('accepts a real-sized image over 100KB (body limit regression)', async () => {
    const png = Buffer.alloc(150 * 1024, 0);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
    const res = await request(app)
      .post('/api/v1/uploads')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ filename: 'bigger.png', data: png.toString('base64') });
    expect(res.status).toBe(201);
    fs.unlinkSync(path.join(UPLOADS_DIR, path.basename(res.body.data.url)));
  });
});