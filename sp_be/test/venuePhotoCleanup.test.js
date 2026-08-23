const request = require('supertest');
const { SignJWT } = require('jose');
const app = require('../app');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid, email) =>
  new SignJWT({ uid, email }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

const BUCKET_URL = 'https://project.supabase.co/storage/v1/object/public/venue_images';

const validVenue = {
  name: 'Photo Cleanup Club',
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

const flush = () => new Promise((resolve) => setImmediate(resolve));

function deletedPaths(posted) {
  return posted.mock.calls
    .filter(([, opts]) => opts && opts.method === 'DELETE')
    .map(([url]) => url);
}

describe('venue photo orphan cleanup', () => {
  let ownerToken;
  let adminToken;
  let posted;

  beforeAll(async () => {
    ownerToken = await tokenFor('demo-owner-uid');
    adminToken = await tokenFor('demo-admin-uid');
  });

  beforeEach(() => {
    posted = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' }));
    vi.stubGlobal('fetch', posted);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('deletes bucket objects that were removed from photos[]', async () => {
    const created = await request(app)
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ ...validVenue, photos: [`${BUCKET_URL}/keep.png`, `${BUCKET_URL}/drop.png`] });
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    const res = await request(app)
      .patch(`/api/v1/venues/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ photos: [`${BUCKET_URL}/keep.png`] });
    expect(res.status).toBe(200);

    await flush();

    const deletes = deletedPaths(posted);
    expect(deletes).toHaveLength(1);
    expect(deletes[0]).toContain('/storage/v1/object/venue_images/drop.png');
  });

  it('deletes every removed object when multiple photos are dropped', async () => {
    const created = await request(app)
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        ...validVenue,
        name: 'Photo Cleanup Club B',
        photos: [`${BUCKET_URL}/a.png`, `${BUCKET_URL}/b.png`, `${BUCKET_URL}/c.png`]
      });
    const id = created.body.data.id;

    const res = await request(app)
      .patch(`/api/v1/venues/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ photos: [`${BUCKET_URL}/a.png`] });
    expect(res.status).toBe(200);

    await flush();

    const deletes = deletedPaths(posted).map((u) => u.split('/').pop()).sort();
    expect(deletes).toEqual(['b.png', 'c.png']);
  });

  it('never deletes non-bucket URLs (legacy /uploads or foreign hosts)', async () => {
    const created = await request(app)
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        ...validVenue,
        name: 'Photo Cleanup Club C',
        photos: ['/uploads/legacy.jpg', 'https://evil.example.com/x.png']
      });
    const id = created.body.data.id;

    const res = await request(app)
      .patch(`/api/v1/venues/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ photos: [] });
    expect(res.status).toBe(200);

    await flush();

    expect(deletedPaths(posted)).toHaveLength(0);
  });

  it('does nothing when photos are unchanged or omitted', async () => {
    const created = await request(app)
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        ...validVenue,
        name: 'Photo Cleanup Club D',
        photos: [`${BUCKET_URL}/same.png`]
      });
    const id = created.body.data.id;

    const res = await request(app)
      .patch(`/api/v1/venues/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ description: 'only description changed' });
    expect(res.status).toBe(200);

    await flush();
    expect(deletedPaths(posted)).toHaveLength(0);
  });

  it('admin edits also trigger orphan cleanup', async () => {
    const created = await request(app)
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        ...validVenue,
        name: 'Photo Cleanup Club E',
        photos: [`${BUCKET_URL}/admin-drop.png`, `${BUCKET_URL}/admin-keep.png`]
      });
    const id = created.body.data.id;

    const res = await request(app)
      .patch(`/api/v1/venues/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ photos: [`${BUCKET_URL}/admin-keep.png`] });
    expect(res.status).toBe(200);

    await flush();
    expect(deletedPaths(posted)).toHaveLength(1);
    expect(deletedPaths(posted)[0]).toContain('/storage/v1/object/venue_images/admin-drop.png');
  });
});