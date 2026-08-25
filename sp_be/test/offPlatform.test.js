// Off-platform venues (ADR-0028 + v1.5 amendment): private visibility,
// business-scoped widget instances (embed key + allowlist + default venue +
// venue-choice lock), widget identity (auto-create player), checkout scoping,
// public QR delivery, business branding, and the allowance/overflow tally.

const request = require('supertest');
const { SignJWT } = require('jose');
const crypto = require('node:crypto');
const app = require('../app');
const pool = require('../db');
const { enableLegacyFlags, enableSms } = require('./helpers/flags');
const smsService = require('../utils/smsService');
const { slugify, mintWidgetKey, sanitizeBrand, sanitizeDomains, isHostAllowed } = require('../utils/widget');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid) =>
  new SignJWT({ uid }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

let posted;
let PLAYER_TOKEN;
let OWNER_TOKEN;
let ADMIN_TOKEN;
let VENUE_ID;
let COURSE_ID;
let INSTANCE_KEY;
let SLUG;

const colomboDate = (daysFromNow) => {
  const d = new Date(Date.now() + daysFromNow * 24 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const isoColombo = (dateStr, timeStr) => `${dateStr}T${timeStr}:00+05:30`;

function codeFromSms(phone) {
  const call = posted.mock.calls.findLast(
    ([, opts]) => typeof opts === 'object' && opts && JSON.parse(opts.body || '{}').to === phone
  );
  if (!call) return null;
  const match = String(JSON.parse(call[1].body).message).match(/\b(\d{6})\b/);
  return match ? match[1] : null;
}

async function createVenue(ownerToken, name) {
  const res = await request(app)
    .post('/api/v1/venues')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      name,
      address: '4 Widget Ave',
      city: 'Colombo',
      accepts_cash: true,
      sports: ['badminton'],
      courts: [
        { name: 'Widget Court', sport: 'badminton', price_per_slot: 1200, slot_duration_min: 60, capacity: 4, is_indoor: true }
      ],
      hours: Array.from({ length: 7 }, (_, d) => ({ day_of_week: d, open_time: '06:00', close_time: '23:00' }))
    });
  return res;
}

async function approve(venueId) {
  return request(app)
    .post(`/api/v1/admin/venues/${venueId}/approve`)
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
}

async function createInstance(ownerToken, input) {
  return request(app)
    .post('/api/v1/business/widget-instances')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send(input);
}

describe('widget helpers (unit)', () => {
  it('slugifies venue names and stays unique-safe', () => {
    expect(slugify('Colombo Air Force Badminton Court')).toBe('colombo-air-force-badminton-court');
    expect(slugify('  !!  ')).toMatch(/^venue-[0-9a-f]{6}$/);
  });

  it('mints 32-hex widget keys', () => {
    const a = mintWidgetKey();
    const b = mintWidgetKey();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });

  it('sanitizes brand tokens', () => {
    const clean = sanitizeBrand({ colors: { primary: '#16a34a', accent: '#AB12CD' }, tagline: '  Book here  ', logo_url: '' });
    expect(clean).toEqual({ colors: { primary: '#16a34a', accent: '#AB12CD' }, tagline: 'Book here', logo_url: '' });
    expect(() => sanitizeBrand({ colors: { primary: 'green' } })).toThrow();
    expect(() => sanitizeBrand({ tagline: 'x'.repeat(81) })).toThrow();
    expect(sanitizeBrand(undefined)).toBeNull();
  });

  it('sanitizes the domain allowlist', () => {
    expect(sanitizeDomains(['TheSite.COM', 'https://thesite.com/', 'thesite.com'])).toEqual(['thesite.com']);
    expect(sanitizeDomains(['localhost:5173'])).toEqual(['localhost:5173']);
    expect(() => sanitizeDomains('thesite.com')).toThrow();
    expect(() => sanitizeDomains(['bad_domain!'])).toThrow();
    expect(() => sanitizeDomains(['host:abc'])).toThrow();
    expect(() => sanitizeDomains(Array(11).fill('a.com'))).toThrow();
  });

  it('matches host origins exactly against the allowlist', () => {
    const holder = { allowed_domains: ['thesite.com', 'book.co', 'localhost:5173'] };
    expect(isHostAllowed(holder, 'https://thesite.com')).toBe(true);
    expect(isHostAllowed(holder, 'http://thesite.com')).toBe(true);
    expect(isHostAllowed(holder, 'https://thesite.com:8443')).toBe(true); // no port = any port
    expect(isHostAllowed(holder, 'https://sub.thesite.com')).toBe(false);
    expect(isHostAllowed(holder, 'https://evil.com')).toBe(false);
    expect(isHostAllowed(holder, 'http://localhost:5173')).toBe(true);   // port-specific
    expect(isHostAllowed(holder, 'http://localhost:4000')).toBe(false);  // different port
    expect(isHostAllowed({ allowed_domains: [] }, 'https://thesite.com')).toBe(false);
  });
});

describe('private venues + business scoping (tickets 01, 02)', () => {
  beforeAll(async () => {
    await enableLegacyFlags();
    await enableSms();
    // SMSGo is exercised through the real fetch path; stub the network like
    // the notification suites do and capture what WOULD have been sent.
    posted = vi.fn(async (_url, opts) => ({ ok: true, status: 200, text: async () => '' }));
    vi.stubGlobal('fetch', posted);
    PLAYER_TOKEN = await tokenFor('widget-player-uid');
    OWNER_TOKEN = await tokenFor('widget-owner-uid');
    ADMIN_TOKEN = await tokenFor('widget-admin-uid');

    await pool.query(
      `insert into users (firebase_uid, email, name, role, status, onboarding_state)
       values ('widget-owner-uid', 'widget-owner@myslot.lk', 'Widget Owner', 'venue_owner', 'active', 'accepted')
       on conflict (firebase_uid) do update set onboarding_state = 'accepted', role = 'venue_owner'`
    );
    await pool.query(
      `insert into users (firebase_uid, email, name, role, status, phone)
       values ('widget-player-uid', 'widget-player@myslot.lk', 'Widget Player', 'player', 'active', '+94771234567')
       on conflict (firebase_uid) do nothing`
    );
    await pool.query(
      `insert into users (firebase_uid, email, name, role, status)
       values ('widget-admin-uid', 'widget-admin@myslot.lk', 'Widget Admin', 'admin', 'active')
       on conflict (firebase_uid) do nothing`
    );

    // Migration 0021 gives every owner a Business; the test owner's venue
    // joins it on create.
    const res = await createVenue(OWNER_TOKEN, 'Private Court Club');
    VENUE_ID = res.body.data.id;
    SLUG = res.body.data.slug;
    const { rows } = await pool.query(`select id from courts where venue_id = $1`, [VENUE_ID]);
    COURSE_ID = rows[0].id;
  });

  it('creates a venue with a slug and joins the owner business', async () => {
    expect(SLUG).toBe('private-court-club');
    const { rows } = await pool.query(`select business_id from venues where id = $1`, [VENUE_ID]);
    expect(rows[0].business_id).toBeTruthy();
  });

  it('serves the owner business profile with the venue portfolio', async () => {
    const res = await request(app)
      .get('/api/v1/business/me')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data.venues.map((v) => v.id)).toContain(VENUE_ID);
    expect(res.body.data.name).toBeTruthy();

    const stranger = await request(app)
      .get('/api/v1/business/me')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`);
    // Business routes require the venue_owner role — a player is rejected
    // before the controller (403, not 404).
    expect(stranger.status).toBe(403);
  });

  it('updates the business name and brand', async () => {
    const res = await request(app)
      .patch('/api/v1/business/me')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ name: 'Private Court Group', brand: { colors: { primary: '#16a34a' }, tagline: 'Book direct' } });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Private Court Group');
    expect(res.body.data.brand.tagline).toBe('Book direct');

    const bad = await request(app)
      .patch('/api/v1/business/me')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ brand: { colors: { primary: 'blue' } } });
    expect(bad.status).toBe(400);
  });

  it('keeps a private venue out of browse/list and direct detail', async () => {
    await approve(VENUE_ID);
    const before = await request(app).get('/api/v1/venues');
    expect(before.body.data.some((v) => v.id === VENUE_ID)).toBe(true);

    const vis = await request(app)
      .patch(`/api/v1/admin/venues/${VENUE_ID}/visibility`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ visibility: 'private' });
    expect(vis.status).toBe(200);

    const listed = await request(app).get('/api/v1/venues');
    expect(listed.body.data.some((v) => v.id === VENUE_ID)).toBe(false);

    const detail = await request(app).get(`/api/v1/venues/${VENUE_ID}`);
    expect(detail.status).toBe(404);
  });

  it('rejects garbage visibility values and non-admin callers', async () => {
    const bad = await request(app)
      .patch(`/api/v1/admin/venues/${VENUE_ID}/visibility`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ visibility: 'stealth' });
    expect(bad.status).toBe(400);

    const owner = await request(app)
      .patch(`/api/v1/admin/venues/${VENUE_ID}/visibility`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ visibility: 'public' });
    expect(owner.status).toBe(403);
  });

  it('still books a private venue via the cash checkout (widget path)', async () => {
    await pool.query(
      `update platform_config set value = 'false'::jsonb where key = 'phone_verification_required'`
    );
    const res = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: COURSE_ID,
        start_at: isoColombo(colomboDate(2), '18:00'),
        end_at: isoColombo(colomboDate(2), '19:00'),
        payment_method: 'cash',
        idempotency_key: 'widget-cash-1'
      });
    expect(res.status).toBe(201);
    expect(res.body.data.booking.status).toBe('confirmed');
  });
});

describe('widget instances + public config (tickets 03, 04)', () => {
  beforeAll(async () => {
    const created = await createInstance(OWNER_TOKEN, {
      name: 'Main website',
      default_venue_id: VENUE_ID,
      allow_venue_choice: false,
      allowed_domains: ['thesite.com', 'https://book.co/']
    });
    expect(created.status).toBe(201);
    INSTANCE_KEY = created.body.data.embed_key;
    expect(INSTANCE_KEY).toMatch(/^[0-9a-f]{32}$/);
    expect(created.body.data.default_venue_id).toBe(VENUE_ID);
    expect(created.body.data.allow_venue_choice).toBe(false);
    expect(created.body.data.allowed_domains).toEqual(['thesite.com', 'book.co']);
  });

  it('exposes widget config only for enabled instances', async () => {
    // Instance is enabled by default and the venue is approved, so config
    // serves; pause the instance and it must darken, then re-enable.
    const list = await request(app)
      .get('/api/v1/business/widget-instances')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);
    const row = list.body.data.find((i) => i.embed_key === INSTANCE_KEY);
    await request(app)
      .patch(`/api/v1/business/widget-instances/${row.id}`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ enabled: false });

    const off = await request(app).get(`/api/v1/public/widget/${INSTANCE_KEY}/config`);
    expect(off.status).toBe(404);

    await request(app)
      .patch(`/api/v1/business/widget-instances/${row.id}`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ enabled: true });

    const unknown = await request(app).get('/api/v1/public/widget/deadbeef/config');
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('WIDGET_NOT_FOUND');
  });

  it('serves config with business brand, instance defaults and the venue', async () => {
    await approve(VENUE_ID);

    const cfg = await request(app).get(`/api/v1/public/widget/${INSTANCE_KEY}/config`);
    expect(cfg.status).toBe(200);
    expect(cfg.body.data.business.name).toBe('Private Court Group');
    expect(cfg.body.data.business.brand.tagline).toBe('Book direct');
    expect(cfg.body.data.instance.default_venue_id).toBe(VENUE_ID);
    expect(cfg.body.data.instance.allow_venue_choice).toBe(false);
    expect(cfg.body.data.venues.map((v) => v.id)).toContain(VENUE_ID);
    expect(cfg.body.data.venues[0].courts).toHaveLength(1);
    expect(cfg.body.data.venues[0].owner_id).toBeUndefined();
    expect(cfg.body.data.venues[0].business_id).toBeUndefined();

    // Allowlist enforcement: a direct load serves, an unapproved origin is
    // denied, an allowed one serves.
    const denied = await request(app).get(`/api/v1/public/widget/${INSTANCE_KEY}/config?origin=https://evil.com`);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('WIDGET_DOMAIN_NOT_ALLOWED');
    const allowed = await request(app).get(`/api/v1/public/widget/${INSTANCE_KEY}/config?origin=https://thesite.com`);
    expect(allowed.status).toBe(200);
  });

  it('validates instance input: default venue must be approved and owned', async () => {
    const other = await createVenue(OWNER_TOKEN, 'Sibling Court');
    const pending = await createInstance(OWNER_TOKEN, {
      name: 'Bad default',
      default_venue_id: other.body.data.id
    });
    expect(pending.status).toBe(400);
    expect(pending.body.error.code).toBe('WIDGET_VALIDATION');

    const badName = await createInstance(OWNER_TOKEN, { name: '' });
    expect(badName.status).toBe(400);

    const badDomains = await createInstance(OWNER_TOKEN, { name: 'x', allowed_domains: 'thesite.com' });
    expect(badDomains.status).toBe(400);

    const stranger = await createInstance(PLAYER_TOKEN, { name: 'hi' });
    expect(stranger.status).toBe(403);
  });

  it('lets the owner list, patch and delete instances', async () => {
    const list = await request(app)
      .get('/api/v1/business/widget-instances')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);
    expect(list.status).toBe(200);
    expect(list.body.data.some((i) => i.embed_key === INSTANCE_KEY)).toBe(true);

    const patch = await request(app)
      .patch(`/api/v1/business/widget-instances/${list.body.data.find((i) => i.embed_key === INSTANCE_KEY).id}`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ allow_venue_choice: true, enabled: false });
    expect(patch.status).toBe(200);
    expect(patch.body.data.allow_venue_choice).toBe(true);
    expect(patch.body.data.enabled).toBe(false);

    // Disabled instance: config dark, branded page dark, OTP keyed calls 404.
    const cfg = await request(app).get(`/api/v1/public/widget/${INSTANCE_KEY}/config`);
    expect(cfg.status).toBe(404);
    const page = await request(app).get(`/api/v1/venues/by-slug/${SLUG}`);
    expect(page.status).toBe(404);
    const send = await request(app).post(`/api/v1/public/widget/${INSTANCE_KEY}/phone/send`).send({ phone: '+94771234000' });
    expect(send.status).toBe(404);

    // Re-enable for later suites.
    await request(app)
      .patch(`/api/v1/business/widget-instances/${list.body.data.find((i) => i.embed_key === INSTANCE_KEY).id}`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ enabled: true });

    const gone = await request(app)
      .delete(`/api/v1/business/widget-instances/${list.body.data.find((i) => i.embed_key === INSTANCE_KEY).id}`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);
    expect(gone.status).toBe(200);
  });

  it('serves the branded page payload by slug with business brand', async () => {
    // The deleted instance took the page down; a fresh enabled one brings it
    // back with the business chrome.
    await createInstance(OWNER_TOKEN, { name: 'Page instance', allow_venue_choice: true });
    const res = await request(app).get(`/api/v1/venues/by-slug/${SLUG}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(VENUE_ID);
    expect(res.body.data.business.name).toBe('Private Court Group');
    expect(res.body.data.business.brand.tagline).toBe('Book direct');
    expect(res.body.data.owner_id).toBeUndefined();
    expect(res.body.data.business_id).toBeUndefined();

    const hidden = await request(app).get('/api/v1/venues/by-slug/definitely-not-a-slug');
    expect(hidden.status).toBe(404);
  });
});

describe('widget identity — unified phone OTP (ticket 03)', () => {
  const FRESH_PHONE = `+9477${String(Date.now()).slice(-7)}`;

  async function sendOtp(phone) {
    return request(app)
      .post(`/api/v1/public/widget/${INSTANCE_KEY}/phone/send`)
      .send({ phone });
  }

  beforeAll(async () => {
    // Recreate the instance the previous suite deleted.
    const created = await createInstance(OWNER_TOKEN, {
      name: 'Identity instance',
      default_venue_id: VENUE_ID,
      allow_venue_choice: true
    });
    INSTANCE_KEY = created.body.data.embed_key;
  });

  it('sends an OTP for a phone with no account yet', async () => {
    const res = await sendOtp(FRESH_PHONE);
    expect(res.status).toBe(200);
    expect(res.body.data.sent).toBe(true);
    expect(codeFromSms(FRESH_PHONE)).toMatch(/^\d{6}$/);
  });

  it('rate-limits resends on the same phone (60s window)', async () => {
    const res = await sendOtp(FRESH_PHONE);
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('OTP_RESEND_TOO_SOON');
  });

  it('rejects a wrong code and burns an attempt', async () => {
    const wrong = await request(app)
      .post(`/api/v1/public/widget/${INSTANCE_KEY}/phone/confirm`)
      .send({ phone: FRESH_PHONE, code: '000000' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.code).toBe('OTP_INVALID');
  });

  it('auto-creates a verified player on a correct code', async () => {
    const code = codeFromSms(FRESH_PHONE);
    const res = await request(app)
      .post(`/api/v1/public/widget/${INSTANCE_KEY}/phone/confirm`)
      .send({ phone: FRESH_PHONE, code });
    expect(res.status).toBe(200);
    expect(res.body.data.is_new).toBe(true);
    expect(res.body.data.token).toBeTruthy();

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${res.body.data.token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.phone).toBe(FRESH_PHONE);
    expect(me.body.data.phone_verified_at).toBeTruthy();

    const { rows } = await pool.query(`select * from users where phone = $1`, [FRESH_PHONE]);
    expect(rows).toHaveLength(1);
    expect(rows[0].phone_verified_at).toBeTruthy();
  });

  it('links an existing player by phone and verifies it', async () => {
    const beforeCount = await pool.query(
      `select count(*)::int as n from users where phone = $1`,
      ['+94771234567']
    );
    await sendOtp('+94771234567');
    const code = codeFromSms('+94771234567');

    const res = await request(app)
      .post(`/api/v1/public/widget/${INSTANCE_KEY}/phone/confirm`)
      .send({ phone: '+94771234567', code });
    expect(res.status).toBe(200);
    expect(res.body.data.is_new).toBe(false);

    const afterCount = await pool.query(
      `select count(*)::int as n from users where phone = $1`,
      ['+94771234567']
    );
    expect(afterCount.rows[0].n).toBe(beforeCount.rows[0].n);
  });
});

describe('checkout scoping — widget bookings stay inside the instance (ticket 05)', () => {
  let lockedKey;
  let freeKey;
  let secondVenueId;

  beforeAll(async () => {
    const locked = await createInstance(OWNER_TOKEN, {
      name: 'Locked embed',
      default_venue_id: VENUE_ID,
      allow_venue_choice: false
    });
    lockedKey = locked.body.data.embed_key;

    const free = await createInstance(OWNER_TOKEN, {
      name: 'Free embed',
      allow_venue_choice: true
    });
    freeKey = free.body.data.embed_key;

    // A second venue of the same business, so "wrong venue" is provable.
    const second = await createVenue(OWNER_TOKEN, 'Second Court Club');
    secondVenueId = second.body.data.id;
    await approve(secondVenueId);
  });

  const book = (courtId, key, extra = {}) =>
    request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: courtId,
        start_at: isoColombo(colomboDate(3), '18:00'),
        end_at: isoColombo(colomboDate(3), '19:00'),
        payment_method: 'cash',
        idempotency_key: `widget-scope-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        widget_instance_key: key,
        ...extra
      });

  it('accepts a booking on the locked default venue', async () => {
    const res = await book(COURSE_ID, lockedKey);
    expect(res.status).toBe(201);
  });

  it('rejects a locked-instance booking on a non-default venue', async () => {
    const { rows } = await pool.query(`select id from courts where venue_id = $1 limit 1`, [secondVenueId]);
    const res = await book(rows[0].id, lockedKey);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WIDGET_VENUE_LOCKED');
  });

  it('accepts any eligible venue on a free-choice instance', async () => {
    const { rows } = await pool.query(`select id from courts where venue_id = $1 limit 1`, [secondVenueId]);
    const res = await book(rows[0].id, freeKey);
    expect(res.status).toBe(201);
  });

  it('rejects venues outside the instance business', async () => {
    // A different owner's venue — must not pass even on a free-choice key.
    const otherOwner = await tokenFor('widget-other-owner-uid');
    await pool.query(
      `insert into users (firebase_uid, email, name, role, status, onboarding_state)
       values ('widget-other-owner-uid', 'widget-other@myslot.lk', 'Other Owner', 'venue_owner', 'active', 'accepted')
       on conflict (firebase_uid) do nothing`
    );
    const theirs = await createVenue(otherOwner, 'Their Court Club');
    await approve(theirs.body.data.id);
    const { rows } = await pool.query(`select id from courts where venue_id = $1 limit 1`, [theirs.body.data.id]);

    const res = await book(rows[0].id, freeKey);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WIDGET_VENUE_NOT_ELIGIBLE');
  });

  it('rejects disabled and unknown instance keys', async () => {
    const inst = await createInstance(OWNER_TOKEN, { name: 'Soon dead', allow_venue_choice: true });
    const list = await request(app)
      .get('/api/v1/business/widget-instances')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);
    const row = list.body.data.find((i) => i.embed_key === inst.body.data.embed_key);
    await request(app)
      .patch(`/api/v1/business/widget-instances/${row.id}`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ enabled: false });

    // A fresh day keeps this test independent of the earlier bookings on
    // this court (the scope check fires before overlap, but stays clean).
    const disabled = await book(COURSE_ID, inst.body.data.embed_key, {
      start_at: isoColombo(colomboDate(5), '18:00'),
      end_at: isoColombo(colomboDate(5), '19:00')
    });
    expect(disabled.status).toBe(403);
    expect(disabled.body.error.code).toBe('WIDGET_INSTANCE_DISABLED');

    const unknown = await book(COURSE_ID, '0'.repeat(32), {
      start_at: isoColombo(colomboDate(5), '20:00'),
      end_at: isoColombo(colomboDate(5), '21:00')
    });
    expect(unknown.status).toBe(403);
    expect(unknown.body.error.code).toBe('WIDGET_INSTANCE_DISABLED');
  });

  it('leaves non-widget checkouts untouched', async () => {
    const res = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        court_id: COURSE_ID,
        start_at: isoColombo(colomboDate(4), '18:00'),
        end_at: isoColombo(colomboDate(4), '19:00'),
        payment_method: 'cash',
        idempotency_key: `widget-nokeys-${Date.now()}`
      });
    expect(res.status).toBe(201);
  });

  it('degrades a locked instance whose default venue becomes ineligible (never a dead embed)', async () => {
    // Suspend the locked instance's default venue: the config must degrade to
    // free venue choice with no preselect, AND checkout must accept the OTHER
    // eligible venue under the same key — scope degrades identically end to
    // end, so the embed can never render a UI whose checkouts all fail.
    await request(app)
      .post(`/api/v1/admin/venues/${VENUE_ID}/suspend`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    try {
      const cfg = await request(app).get(`/api/v1/public/widget/${lockedKey}/config`);
      expect(cfg.status).toBe(200);
      expect(cfg.body.data.instance.default_venue_id).toBeNull();
      expect(cfg.body.data.instance.allow_venue_choice).toBe(true);

      const { rows } = await pool.query(`select id from courts where venue_id = $1 limit 1`, [secondVenueId]);
      const res = await book(rows[0].id, lockedKey, {
        start_at: isoColombo(colomboDate(6), '18:00'),
        end_at: isoColombo(colomboDate(6), '19:00')
      });
      expect(res.status).toBe(201);
    } finally {
      await request(app)
        .post(`/api/v1/admin/venues/${VENUE_ID}/unsuspend`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    }
  });
});

describe('public QR delivery (ticket 05)', () => {
  it('builds a QR link with the secret token', () => {
    const url = smsService.bookingQrUrl('abc-123', 'a'.repeat(32));
    expect(url).toContain('/api/v1/public/qr/abc-123?t=');
  });

  it('serves the QR PNG only with the right token', async () => {
    const { rows } = await pool.query(
      `select id, qr_token from bookings where idempotency_key = 'widget-cash-1'`
    );
    expect(rows).toHaveLength(1);
    const { id, qr_token } = rows[0];

    const ok = await request(app).get(`/api/v1/public/qr/${id}?t=${qr_token}`);
    expect(ok.status).toBe(200);
    expect(ok.headers['content-type']).toContain('image/png');

    const wrong = await request(app).get(`/api/v1/public/qr/${id}?t=${'0'.repeat(32)}`);
    expect(wrong.status).toBe(404);

    const missing = await request(app).get(`/api/v1/public/qr/${id}`);
    expect(missing.status).toBe(404);
  });
});

describe('booking allowance tally (ticket 10)', () => {
  beforeAll(async () => {
    const tmpl = await request(app)
      .post('/api/v1/admin/owners/plan-templates')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ name: 'Starter', term_days: 30, price_lkr: 5000, booking_allowance: 10, overflow_fee_percent: 5 });
    expect(tmpl.status).toBe(201);
    expect(tmpl.body.data.booking_allowance).toBe(10);
    expect(tmpl.body.data.overflow_fee_percent).toBe(5);

    const tmpl2 = await request(app)
      .patch(`/api/v1/admin/owners/plan-templates/${tmpl.body.data.id}`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ overflow_fee_percent: 7 });
    expect(tmpl2.status).toBe(200);
    expect(tmpl2.body.data.booking_allowance).toBe(10);
    expect(tmpl2.body.data.overflow_fee_percent).toBe(7);
  });

  it('tallies usage, overflow count and fee estimate for a month', async () => {
    const month = colomboDate(0).slice(0, 7);
    const owner = await pool.query(`select id from users where firebase_uid = 'widget-owner-uid'`);
    const ownerId = owner.rows[0].id;

    const res = await request(app)
      .get(`/api/v1/admin/owners/${ownerId}/allowance?month=${month}`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data.usage).toBeGreaterThanOrEqual(1);
    expect(res.body.data.overflow_count).toBeGreaterThanOrEqual(0);
    expect(res.body.data.fee_estimate_lkr).toBeGreaterThanOrEqual(0);

    const bad = await request(app)
      .get(`/api/v1/admin/owners/${ownerId}/allowance?month=nope`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(bad.status).toBe(400);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });
});