// Off-platform venues (ADR-0028, tickets 01-05, 09-10): private visibility,
// widget key + allowlist, widget identity (auto-create player), public QR
// delivery, branding settings, and the allowance/overflow tally.

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
let WIDGET_KEY;
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
    const venue = { allowed_domains: ['thesite.com', 'book.co', 'localhost:5173'] };
    expect(isHostAllowed(venue, 'https://thesite.com')).toBe(true);
    expect(isHostAllowed(venue, 'http://thesite.com')).toBe(true);
    expect(isHostAllowed(venue, 'https://thesite.com:8443')).toBe(true); // no port = any port
    expect(isHostAllowed(venue, 'https://sub.thesite.com')).toBe(false);
    expect(isHostAllowed(venue, 'https://evil.com')).toBe(false);
    expect(isHostAllowed(venue, 'http://localhost:5173')).toBe(true);   // port-specific
    expect(isHostAllowed(venue, 'http://localhost:4000')).toBe(false);  // different port
    expect(isHostAllowed({ allowed_domains: [] }, 'https://thesite.com')).toBe(false);
  });
});

describe('private venues (ticket 01)', () => {
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

    // The owner must exist as an accepted-terms venue_owner to create venues
    // (ADR-0022 gate); the player exists as a plain unverified player.
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

    const res = await createVenue(OWNER_TOKEN, 'Private Court Club');
    VENUE_ID = res.body.data.id;
    SLUG = res.body.data.slug;
    WIDGET_KEY = res.body.data.widget_key;
    const { rows } = await pool.query(`select id from courts where venue_id = $1`, [VENUE_ID]);
    COURSE_ID = rows[0].id;
  });

  it('creates a venue with slug + widget key', () => {
    expect(SLUG).toBe('private-court-club');
    expect(WIDGET_KEY).toMatch(/^[0-9a-f]{32}$/);
  });

  it('keeps a private venue out of browse/list and direct detail', async () => {
    await approve(VENUE_ID);
    // first visible as public
    const before = await request(app).get('/api/v1/venues');
    expect(before.body.data.some((v) => v.id === VENUE_ID)).toBe(true);

    const vis = await request(app)
      .patch(`/api/v1/admin/venues/${VENUE_ID}/visibility`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ visibility: 'private' });
    expect(vis.status).toBe(200);
    expect(vis.body.data.visibility).toBe('private');

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
    // The widget verifies the phone BEFORE checkout (ticket 03), so the
    // phone_verification_required gate is never hit from a real widget. This
    // test isolates the private-venue bookability: open the gate, book.
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

describe('widget config + owner settings (tickets 02, 08)', () => {
  it('exposes widget config only when enabled and approved', async () => {
    const off = await request(app).get(`/api/v1/public/widget/${WIDGET_KEY}/config`);
    expect(off.status).toBe(404); // widget_enabled defaults off

    const unknown = await request(app).get('/api/v1/public/widget/deadbeef/config');
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('WIDGET_NOT_FOUND');
  });

  it('lets the owner read and patch widget settings', async () => {
    const read = await request(app)
      .get(`/api/v1/business/venues/${VENUE_ID}/widget`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);
    expect(read.status).toBe(200);
    expect(read.body.data.widget_key).toBe(WIDGET_KEY);
    expect(read.body.data.widget_enabled).toBe(false);

    const patch = await request(app)
      .patch(`/api/v1/business/venues/${VENUE_ID}/widget`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({
        widget_enabled: true,
        allowed_domains: ['thesite.com', 'https://book.co/'],
        brand: { colors: { primary: '#16a34a' }, tagline: 'Book direct' }
      });
    expect(patch.status).toBe(200);
    expect(patch.body.data.widget_enabled).toBe(true);
    expect(patch.body.data.allowed_domains).toEqual(['thesite.com', 'book.co']);

    // Allowlist enforcement: the config endpoint still serves a direct load,
    // denies an unapproved origin, and serves an allowed one.
    const cfg = await request(app).get(`/api/v1/public/widget/${WIDGET_KEY}/config`);
    expect(cfg.status).toBe(200);
    const denied = await request(app).get(`/api/v1/public/widget/${WIDGET_KEY}/config?origin=https://evil.com`);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('WIDGET_DOMAIN_NOT_ALLOWED');
    const allowed = await request(app).get(`/api/v1/public/widget/${WIDGET_KEY}/config?origin=https://thesite.com`);
    expect(allowed.status).toBe(200);

    expect(allowed.body.data.name).toBe('Private Court Club');
    expect(allowed.body.data.brand.tagline).toBe('Book direct');
    expect(allowed.body.data.courts).toHaveLength(1);
    expect(allowed.body.data.widget_key).toBe(WIDGET_KEY);
    expect(allowed.body.data.owner_id).toBeUndefined();
    expect(allowed.body.data.allowed_domains).toBeUndefined();
  });

  it('rejects invalid brand/domains and non-owners', async () => {
    const badBrand = await request(app)
      .patch(`/api/v1/business/venues/${VENUE_ID}/widget`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ brand: { colors: { primary: 'blue' } } });
    expect(badBrand.status).toBe(400);

    const badDomains = await request(app)
      .patch(`/api/v1/business/venues/${VENUE_ID}/widget`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ allowed_domains: 'thesite.com' });
    expect(badDomains.status).toBe(400);

    const stranger = await request(app)
      .patch(`/api/v1/business/venues/${VENUE_ID}/widget`)
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({ widget_enabled: false });
    expect(stranger.status).toBe(403);
  });

  it('serves the branded page payload by slug', async () => {
    const res = await request(app).get(`/api/v1/venues/by-slug/${SLUG}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(VENUE_ID);
    expect(res.body.data.owner_id).toBeUndefined();

    const hidden = await request(app).get('/api/v1/venues/by-slug/definitely-not-a-slug');
    expect(hidden.status).toBe(404);
  });
});

describe('widget identity — unified phone OTP (ticket 03)', () => {
  // Unique per run: the shared test DB is used by every suite, so a fixed
  // phone would collide with users another suite created for the same number.
  const FRESH_PHONE = `+9477${String(Date.now()).slice(-7)}`;

  async function sendOtp(phone) {
    return request(app)
      .post(`/api/v1/public/widget/${WIDGET_KEY}/phone/send`)
      .send({ phone });
  }

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
      .post(`/api/v1/public/widget/${WIDGET_KEY}/phone/confirm`)
      .send({ phone: FRESH_PHONE, code: '000000' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.code).toBe('OTP_INVALID');
  });

  it('auto-creates a verified player on a correct code', async () => {
    const code = codeFromSms(FRESH_PHONE);
    const res = await request(app)
      .post(`/api/v1/public/widget/${WIDGET_KEY}/phone/confirm`)
      .send({ phone: FRESH_PHONE, code });
    expect(res.status).toBe(200);
    expect(res.body.data.is_new).toBe(true);
    expect(res.body.data.token).toBeTruthy();

    // The token is a real session: it passes the app's own auth middleware.
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${res.body.data.token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.phone).toBe(FRESH_PHONE);
    expect(me.body.data.phone_verified_at).toBeTruthy();
    expect(me.body.data.role).toBe('player');

    // And the created player is a normal player row.
    const { rows } = await pool.query(`select * from users where phone = $1`, [FRESH_PHONE]);
    expect(rows).toHaveLength(1);
    expect(rows[0].phone_verified_at).toBeTruthy();
  });

  it('links an existing player by phone and verifies it', async () => {
    // The player was seeded (widget-player-uid). A widget OTP on that phone
    // must link the account, not duplicate it.
    const beforeCount = await pool.query(
      `select count(*)::int as n from users where phone = $1`,
      ['+94771234567']
    );
    await sendOtp('+94771234567');
    const code = codeFromSms('+94771234567');

    const res = await request(app)
      .post(`/api/v1/public/widget/${WIDGET_KEY}/phone/confirm`)
      .send({ phone: '+94771234567', code });
    expect(res.status).toBe(200);
    expect(res.body.data.is_new).toBe(false);
    expect(res.body.data.token).toBeTruthy();

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${res.body.data.token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.phone).toBe('+94771234567');
    expect(me.body.data.phone_verified_at).toBeTruthy();

    // Linked, not duplicated — the count is unchanged by the confirm.
    const afterCount = await pool.query(
      `select count(*)::int as n from users where phone = $1`,
      ['+94771234567']
    );
    expect(afterCount.rows[0].n).toBe(beforeCount.rows[0].n);
  });
});

describe('branded page + widget gating (tickets 06, 07)', () => {
  it('turning the widget off hides the branded page and the config', async () => {
    await request(app)
      .patch(`/api/v1/business/venues/${VENUE_ID}/widget`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ widget_enabled: false });

    const page = await request(app).get(`/api/v1/venues/by-slug/${SLUG}`);
    expect(page.status).toBe(404);

    const cfg = await request(app).get(`/api/v1/public/widget/${WIDGET_KEY}/config`);
    expect(cfg.status).toBe(404);
  });

  it('a pending venue cannot go live', async () => {
    const res = await createVenue(OWNER_TOKEN, 'Not Approved Yet');
    const pendingVenue = res.body.data;
    const enable = await request(app)
      .patch(`/api/v1/business/venues/${pendingVenue.id}/widget`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ widget_enabled: true });
    expect(enable.status).toBe(400);
    expect(enable.body.error.code).toBe('WIDGET_APPROVAL_REQUIRED');
  });

  it('self-heals venues created before the feature: missing key/slug are minted on save', async () => {
    // Simulate a pre-feature venue (NULL widget_key + slug).
    await pool.query(
      `update venues set widget_key = null, slug = null where id = $1`,
      [VENUE_ID]
    );
    const patch = await request(app)
      .patch(`/api/v1/business/venues/${VENUE_ID}/widget`)
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ widget_enabled: false });
    expect(patch.status).toBe(200);
    expect(patch.body.data.widget_key).toMatch(/^[0-9a-f]{32}$/);
    expect(patch.body.data.slug).toBeTruthy();
    expect(patch.body.data.slug).not.toBeNull();
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

    // partial template PATCH keeps other fields (regression)
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