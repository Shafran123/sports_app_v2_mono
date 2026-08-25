// Dedicated Sites (ADR-0029): Site Domain Request workflow — owner request /
// re-request, admin queue + transitions (approve → dns-added → verify →
// live / rejected), automated DNS verification, DB-driven trusted origins,
// the public site resolution (with Private Venues listed), the by-slug
// redirect payload, and site-context checkout scoping.

const request = require('supertest');
const { SignJWT } = require('jose');
const dns = require('node:dns');
const app = require('../app');
const pool = require('../db');
const siteDomains = require('../services/siteDomains');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid) =>
  new SignJWT({ uid, email: `${uid}@myslot.test`, email_verified: true }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

const colomboDate = (daysFromNow) => {
  const d = new Date(Date.now() + daysFromNow * 24 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const isoColombo = (dateStr, timeStr) => `${dateStr}T${timeStr}:00+05:30`;

let PLAYER_TOKEN;
let OWNER_TOKEN;
let ADMIN_TOKEN;
let VENUE_ID;
let PRIVATE_VENUE_ID;
let COURT_ID;
let REQUEST_ID;

async function createVenue(token, name) {
  return request(app)
    .post('/api/v1/venues')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name,
      address: '9 Site Ave',
      city: 'Colombo',
      accepts_cash: true,
      sports: ['badminton'],
      courts: [
        { name: 'Site Court', sport: 'badminton', price_per_slot: 1000, slot_duration_min: 60, capacity: 4, is_indoor: true }
      ],
      hours: Array.from({ length: 7 }, (_, d) => ({ day_of_week: d, open_time: '06:00', close_time: '23:00' }))
    });
}

describe('site domain request workflow (ADR-0029)', () => {
  beforeAll(async () => {
    await pool.query(`delete from site_domain_requests`);
    PLAYER_TOKEN = await tokenFor('site-player-uid');
    OWNER_TOKEN = await tokenFor('site-owner-uid');
    ADMIN_TOKEN = await tokenFor('site-admin-uid');

    await pool.query(
      `insert into users (firebase_uid, email, name, role, status, onboarding_state)
       values ('site-owner-uid', 'site-owner@myslot.lk', 'Site Owner', 'venue_owner', 'active', 'accepted')
       on conflict (firebase_uid) do update set onboarding_state = 'accepted', role = 'venue_owner'`
    );
    await pool.query(
      `insert into users (firebase_uid, email, name, role, status, phone)
       values ('site-player-uid', 'site-player@myslot.lk', 'Site Player', 'player', 'active', '+94772345678')
       on conflict (firebase_uid) do nothing`
    );
    await pool.query(
      `insert into users (firebase_uid, email, name, role, status)
       values ('site-admin-uid', 'site-admin@myslot.lk', 'Site Admin', 'admin', 'active')
       on conflict (firebase_uid) do nothing`
    );

    const res = await createVenue(OWNER_TOKEN, 'Site Sports Centre');
    VENUE_ID = res.body.data.id;
    const priv = await createVenue(OWNER_TOKEN, 'Site Private Club');
    PRIVATE_VENUE_ID = priv.body.data.id;
    const { rows } = await pool.query(`select id from courts where venue_id = $1`, [VENUE_ID]);
    COURT_ID = rows[0].id;

    // Approve both venues; the second one is private — still on the site.
    await request(app).post(`/api/v1/admin/venues/${VENUE_ID}/approve`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    await request(app).post(`/api/v1/admin/venues/${PRIVATE_VENUE_ID}/approve`).set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    await pool.query(`update venues set visibility = 'private' where id = $1`, [PRIVATE_VENUE_ID]);
  });

  it('returns an empty owner state with a suggested subdomain', async () => {
    const res = await request(app)
      .get('/api/v1/business/site-request')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data.suggested_subdomain).toBe('site-sports-centre.myslot.lk');
  });

  it('rejects malformed hostnames', async () => {
    const bad = await request(app)
      .post('/api/v1/business/site-request')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ hostname_kind: 'custom', hostname: 'not a host' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('SITE_REQUEST_VALIDATION');
  });

  it('normalizes a www custom host to its apex and stores a TXT token', async () => {
    const res = await request(app)
      .post('/api/v1/business/site-request')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ hostname_kind: 'custom', hostname: 'WWW.site-test.lk' });
    expect(res.status).toBe(201);
    expect(res.body.data.hostname).toBe('site-test.lk');
    expect(res.body.data.dns_type).toBe('TXT');
    expect(res.body.data.dns_value).toMatch(/^myslot-site-verification=[0-9a-f]{32}$/);
    REQUEST_ID = res.body.data.id;
  });

  it('blocks a second request while one is in flight', async () => {
    const res = await request(app)
      .post('/api/v1/business/site-request')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ hostname_kind: 'custom', hostname: 'other-site.lk' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SITE_REQUEST_EXISTS');
  });

  it('blocks the same hostname claimed by another business', async () => {
    const OWNER2_TOKEN = await tokenFor('site-owner-2-uid');
    await pool.query(
      `insert into users (firebase_uid, email, name, role, status, onboarding_state)
       values ('site-owner-2-uid', 'site-owner-2@myslot.lk', 'Site Owner Two', 'venue_owner', 'active', 'accepted')
       on conflict (firebase_uid) do update set onboarding_state = 'accepted', role = 'venue_owner'`
    );
    const venue = await createVenue(OWNER2_TOKEN, 'Rival Sports Club');
    expect(venue.status).toBe(201);

    const res = await request(app)
      .post('/api/v1/business/site-request')
      .set('Authorization', `Bearer ${OWNER2_TOKEN}`)
      .send({ hostname_kind: 'custom', hostname: 'site-test.lk' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SITE_REQUEST_CONFLICT');
  });

  it('shows the request in the admin queue with business + owner context', async () => {
    const res = await request(app)
      .get('/api/v1/admin/sites')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    const row = res.body.data.find((r) => r.id === REQUEST_ID);
    expect(row).toBeTruthy();
    expect(row.business_name).toBe('Site Sports Centre');
    expect(row.owner_email).toBe('site-owner@myslot.lk');
    expect(row.venue_count).toBe(2);
    expect(row.status).toBe('requested');
  });

  it('walks the state machine to live, with automated DNS verification', async () => {
    const approve = await request(app)
      .post(`/api/v1/admin/sites/${REQUEST_ID}/approve`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(approve.status).toBe(200);
    expect(approve.body.data.status).toBe('approved');

    // Owner says the record is added → dns_pending.
    const added = await request(app)
      .post('/api/v1/business/site-request/dns-added')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);
    expect(added.status).toBe(200);
    expect(added.body.data.status).toBe('dns_pending');

    // Verification fails while the DNS record is absent → stays dns_pending.
    const pending = await request(app)
      .post(`/api/v1/admin/sites/${REQUEST_ID}/verify`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(pending.status).toBe(200);
    expect(pending.body.data.status).toBe('dns_pending');

    // The owner's TXT token appears in DNS → verifying.
    const token = (await pool.query(`select dns_value from site_domain_requests where id = $1`, [REQUEST_ID])).rows[0].dns_value.split('=')[1];
    const resolveTxt = vi.spyOn(dns.promises, 'resolveTxt').mockResolvedValue([[`myslot-site-verification=${token}`]]);
    const verifying = await request(app)
      .post(`/api/v1/admin/sites/${REQUEST_ID}/verify`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(verifying.body.data.status).toBe('verifying');
    resolveTxt.mockRestore();

    // Staff complete the checklist, then mark live.
    const checklist = await request(app)
      .patch(`/api/v1/admin/sites/${REQUEST_ID}/checklist`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ key: 'auth_domain', done: true });
    expect(checklist.body.data.checklist.find((c) => c.key === 'auth_domain').done).toBe(true);

    const live = await request(app)
      .post(`/api/v1/admin/sites/${REQUEST_ID}/mark-live`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(live.body.data.status).toBe('live');
    expect(live.body.data.live_at).toBeTruthy();
  });

  it('resolves the live hostname publicly with brand + all venues (private included)', async () => {
    const res = await request(app).get(`/api/v1/public/site/by-hostname?host=site-test.lk`);
    expect(res.status).toBe(200);
    expect(res.body.data.business.name).toBe('Site Sports Centre');
    const ids = res.body.data.venues.map((v) => v.id);
    expect(ids).toContain(VENUE_ID);
    expect(ids).toContain(PRIVATE_VENUE_ID);
    expect(res.body.data.venues[0].sports).toContain('Badminton');
  });

  it('resolves the www twin and denies a non-live host', async () => {
    const www = await request(app).get(`/api/v1/public/site/by-hostname?host=www.site-test.lk`);
    expect(www.status).toBe(200);

    const unknown = await request(app).get(`/api/v1/public/site/by-hostname?host=not-live.lk`);
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('SITE_NOT_LIVE');
  });

  it('admits the live hostname to the trusted origin set', async () => {
    const { getAllowedOrigins } = require('../utils/origins');
    const origins = await getAllowedOrigins({ FRONTEND_URL: 'https://app.myslot.lk' });
    expect(origins).toContain('site-test.lk');
    expect(origins).toContain('www.site-test.lk');
  });

  it('carries the site hostname in the by-slug payload for redirects', async () => {
    const res = await request(app).get(`/api/v1/venues/by-slug/site-sports-centre`);
    expect(res.status).toBe(200);
    expect(res.body.data.business.site_hostname).toBe('site-test.lk');
  });

  it('scopes checkout: a dead or foreign site host never books', async () => {
    await pool.query(
      `update platform_config set value = 'false'::jsonb where key = 'phone_verification_required'`
    );
    const payload = {
      court_id: COURT_ID,
      start_at: isoColombo(colomboDate(3), '18:00'),
      end_at: isoColombo(colomboDate(3), '19:00'),
      payment_method: 'cash',
      idempotency_key: 'site-cash-1'
    };
    const dead = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({ ...payload, site_hostname: 'dead-host.lk' });
    expect(dead.status).toBe(403);
    expect(dead.body.error.code).toBe('SITE_HOST_NOT_LIVE');

    const ok = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({ ...payload, idempotency_key: 'site-cash-2', site_hostname: 'www.site-test.lk' });
    expect(ok.status).toBe(201);
    expect(ok.body.data.booking.site_hostname).toBe('www.site-test.lk');

    const { rows } = await pool.query(
      `select site_hostname from bookings where idempotency_key = 'site-cash-2'`
    );
    expect(rows[0].site_hostname).toBe('www.site-test.lk');
  });

  it('rejects with a reason, then the owner edits and re-requests', async () => {
    const rejected = await request(app)
      .post(`/api/v1/admin/sites/${REQUEST_ID}/reject`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ reason: 'Hostname conflicts with an existing platform property.' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.status).toBe('rejected');
    expect(rejected.body.data.rejection_reason).toContain('conflicts');

    const edit = await request(app)
      .post('/api/v1/business/site-request')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`)
      .send({ hostname_kind: 'subdomain', hostname: 'site-sports-centre.myslot.lk' });
    expect(edit.status).toBe(201);
    expect(edit.body.data.hostname).toBe('site-sports-centre.myslot.lk');
    expect(edit.body.data.status).toBe('requested');
    expect(edit.body.data.dns_type).toBe('CNAME');
    expect(edit.body.data.rejection_reason).toBeNull();
  });

  it('blocks dns-added before approval', async () => {
    const res = await request(app)
      .post('/api/v1/business/site-request/dns-added')
      .set('Authorization', `Bearer ${OWNER_TOKEN}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SITE_REQUEST_BAD_STATE');
  });

  it('unit: normalizeHostname and suggestSubdomain', () => {
    expect(siteDomains.normalizeHostname('WWW.ABC.lk.')).toBe('abc.lk');
    expect(siteDomains.normalizeHostname('abc.lk')).toBe('abc.lk');
    expect(siteDomains.suggestSubdomain('ABC Sports & Fitness')).toBe('abc-sports-fitness.myslot.lk');
  });
});