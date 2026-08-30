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
const { enableBusinessCash } = require('./helpers/methods');
const smsService = require('../utils/smsService');
const { slugify, mintWidgetKey, sanitizeBrand, sanitizeDomains, isHostAllowed } = require('../utils/widget');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid) =>
  new SignJWT({ uid, email: `${uid}@myslot.test`, email_verified: true }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

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
  const wireTo = phone.replace(/^\+/, '');
  const call = posted.mock.calls.findLast(
    ([, opts]) => typeof opts === 'object' && opts && JSON.parse(opts.body || '{}').to === wireTo
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

  it('sanitizes site-brand tokens (ADR-0031): long about, contact, banner', () => {
    const clean = sanitizeBrand({
      tagline: 'Book direct',
      about: 'Paragraph one. '.repeat(30),
      banner_image: 'https://cdn.test/banner.jpg',
      contact: { phone: '+94 77 123 4567', email: 'hello@abc.lk', address: '12 Galle Rd, Colombo', hours: 'Mon–Sun 6am–11pm' }
    });
    expect(clean.banner_image).toBe('https://cdn.test/banner.jpg');
    expect(clean.about.length).toBe('Paragraph one. '.repeat(30).trim().length);
    expect(clean.contact).toEqual({ phone: '+94 77 123 4567', email: 'hello@abc.lk', address: '12 Galle Rd, Colombo', hours: 'Mon–Sun 6am–11pm' });

    // Bad https, overlong tagline/about, malformed contact all rejected.
    expect(() => sanitizeBrand({ banner_image: 'http://insecure.co/x.jpg' })).toThrow();
    expect(() => sanitizeBrand({ tagline: 'x'.repeat(81) })).toThrow();
    expect(() => sanitizeBrand({ about: 'x'.repeat(501) })).toThrow();
    expect(() => sanitizeBrand({ contact: 'phone only' })).toThrow();
    // Unknown keys still dropped (headline is retired, not accepted).
    const dropped = sanitizeBrand({ headline: 'Hi', bogus: 'nope' });
    expect(dropped).toEqual({});
  });

  it('sanitizes Social Links (ADR-0034): optional per-platform https URLs', () => {
    const clean = sanitizeBrand({
      social_links: {
        facebook: 'https://facebook.com/acme',
        instagram: '  https://instagram.com/acme  ',
        tiktok: '',
        whatsapp: 'https://wa.me/94770000000',
        youtube: undefined,
        bogus: 'https://nope.test'
      }
    });
    expect(clean.social_links).toEqual({
      facebook: 'https://facebook.com/acme',
      instagram: 'https://instagram.com/acme',
      tiktok: '',
      whatsapp: 'https://wa.me/94770000000'
    });
    // Non-https and non-object shapes are rejected.
    expect(() => sanitizeBrand({ social_links: { facebook: 'facebook.com/acme' } })).toThrow();
    expect(() => sanitizeBrand({ social_links: ['https://facebook.com/acme'] })).toThrow();
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
    posted = vi.fn(async (_url, opts) => ({ ok: true, status: 200, text: async () => '', json: async () => ({ success: true, data: { id: 'msg_widget' } }) }));
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
    // ADR-0044: the widget's cash checkout runs on the Business's cash method.
    await enableBusinessCash('widget-owner-uid', true);
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

  it('round-trips site-brand fields (ADR-0031) through the profile endpoint', async () => {
    const res = await request(app)
      .patch('/api/v1/business/me')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({
        brand: {
          banner_image: 'https://cdn.test/banner.jpg',
          about: 'Paragraph one. '.repeat(20).trim(),
          contact: { phone: '+94 77 123 4567', email: 'hello@abc.lk', address: '12 Galle Rd, Colombo', hours: 'Mon–Sun 6am–11pm' },
          social_links: { facebook: 'https://facebook.com/acme', instagram: '' }
        }
      });
    expect(res.status).toBe(200);
    expect(res.body.data.brand.banner_image).toBe('https://cdn.test/banner.jpg');
    expect(res.body.data.brand.contact.email).toBe('hello@abc.lk');
    expect(res.body.data.brand.social_links).toEqual({ facebook: 'https://facebook.com/acme', instagram: '' });
    // Partial-brand semantics (ADR-0031): a site-brand patch never wipes the
    // shared tokens set earlier.
    expect(res.body.data.brand.tagline).toBe('Book direct');
    expect(res.body.data.brand.colors.primary).toBe('#16a34a');

    const badSocial = await request(app)
      .patch('/api/v1/business/me')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ brand: { social_links: { facebook: 'not-a-url' } } });
    expect(badSocial.status).toBe(400);
  });

  it('clears a brand token with an explicit empty string, keeping the rest (ADR-0031)', async () => {
    const res = await request(app)
      .patch('/api/v1/business/me')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ brand: { privacy_policy: '' } });
    expect(res.status).toBe(200);
    expect(res.body.data.brand.privacy_policy).toBe('');
    expect(res.body.data.brand.tagline).toBe('Book direct');
    expect(res.body.data.brand.social_links.facebook).toBe('https://facebook.com/acme');
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