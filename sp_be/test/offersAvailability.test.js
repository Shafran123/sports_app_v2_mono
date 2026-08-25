const request = require('supertest');
const { SignJWT } = require('jose');
const app = require('../app');
const pool = require('../db');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid) =>
  new SignJWT({ uid }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

function colomboDate(daysFromNow) {
  const d = new Date(Date.now() + daysFromNow * 24 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function isoColombo(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00+05:30`;
}

describe('offers reflect on player availability', () => {
  let venueId;
  let courtId;

  async function createVenue(name, price = 1500) {
    const ownerToken = await tokenFor('demo-owner-uid');
    const adminToken = await tokenFor('demo-admin-uid');
    const created = await request(app)
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name,
        address: '1 Offer Ave',
        city: 'Colombo',
        sports: ['badminton'],
        courts: [{ name: 'Offer Court', sport: 'badminton', price_per_slot: price, slot_duration_min: 60 }],
        hours: Array.from({ length: 7 }, (_, d) => ({ day_of_week: d, open_time: '06:00', close_time: '23:00' }))
      });
    await request(app)
      .post(`/api/v1/admin/venues/${created.body.data.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    return created.body.data.id;
  }

  async function courtFor(v) {
    const { rows } = await pool.query(`select id from courts where venue_id = $1`, [v]);
    return rows[0].id;
  }

  async function availSlot(v, c) {
    const date = colomboDate(2);
    const res = await request(app).get(`/api/v1/venues/${v}/availability?date=${date}`);
    expect(res.status).toBe(200);
    const court = res.body.data.courts.find((x) => x.court_id === c);
    return court.slots.find((s) => s.state === 'available');
  }

  it('a slot offer discounts matching availability slots', async () => {
    venueId = await createVenue('Slot Offer Venue');
    courtId = await courtFor(venueId);
    const ownerToken = await tokenFor('demo-owner-uid');
    const offer = await request(app)
      .post(`/api/v1/business/venues/${venueId}/offers`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ kind: 'slot', discount_type: 'percent', percent: 20 });
    expect(offer.status).toBe(201);

    const slot = await availSlot(venueId, courtId);
    expect(slot.price).toBe(1500);
    expect(slot.offer_price).toBe(1200);
  });

  it('a slot offer scoped to another day leaves slots at full price', async () => {
    const v = await createVenue('Scoped Offer Venue');
    const c = await courtFor(v);
    const ownerToken = await tokenFor('demo-owner-uid');
    // Offer only on a weekday that is not the requested date's weekday.
    const otherDow = (new Date().getDay() + 3) % 7;
    const offer = await request(app)
      .post(`/api/v1/business/venues/${v}/offers`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ kind: 'slot', discount_type: 'percent', percent: 30, windows: [{ day_of_week: otherDow, start_time: '06:00', end_time: '23:00' }] });
    expect(offer.status).toBe(201);

    const slot = await availSlot(v, c);
    expect(slot.price).toBe(1500);
    expect(slot.offer_price).toBe(null);
  });

  it('a venue-wide offer is exposed on the availability response for the badge', async () => {
    const v = await createVenue('Venue Offer Venue');
    const ownerToken = await tokenFor('demo-owner-uid');
    const offer = await request(app)
      .post(`/api/v1/business/venues/${v}/offers`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ kind: 'venue', discount_type: 'percent', percent: 15 });
    expect(offer.status).toBe(201);

    const date = colomboDate(2);
    const res = await request(app).get(`/api/v1/venues/${v}/availability?date=${date}`);
    expect(res.status).toBe(200);
    expect(res.body.data.venue_offer).toEqual({ discount_type: 'percent', value: 15 });
  });

  it('a paused venue-wide offer is not exposed', async () => {
    const v = await createVenue('Paused Venue Offer Venue');
    const ownerToken = await tokenFor('demo-owner-uid');
    const offer = await request(app)
      .post(`/api/v1/business/venues/${v}/offers`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ kind: 'venue', discount_type: 'percent', percent: 15 });
    await request(app)
      .patch(`/api/v1/business/offers/${offer.body.data.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ is_active: false });

    const date = colomboDate(2);
    const res = await request(app).get(`/api/v1/venues/${v}/availability?date=${date}`);
    expect(res.body.data.venue_offer).toBe(null);
  });

  it('checkout charges the venue-wide discounted amount', async () => {
    const v = await createVenue('Venue Offer Checkout Venue');
    const c = await courtFor(v);
    const ownerToken = await tokenFor('demo-owner-uid');
    const playerToken = await tokenFor('demo-player-uid');

    await request(app)
      .post(`/api/v1/business/venues/${v}/offers`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ kind: 'venue', discount_type: 'percent', percent: 20 });

    const { rows } = await pool.query(`update venues set accepts_cash = true where id = $1 returning id`, [v]);

    const res = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({
        court_id: c,
        start_at: isoColombo(colomboDate(3), '09:00'),
        end_at: isoColombo(colomboDate(3), '10:00'),
        idempotency_key: `venue-offer-${Date.now()}`,
        payment_method: 'cash'
      });
    expect(res.status).toBe(201);
    // 1500 base, 20% venue-wide → 1200.
    expect(res.body.data.amount).toBe(1200);
  });
});
