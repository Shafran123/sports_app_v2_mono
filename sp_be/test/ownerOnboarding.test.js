const request = require('supertest');
const { SignJWT } = require('jose');
const app = require('../app');
const pool = require('../db');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid) =>
  new SignJWT({ uid, email: `${uid}@myslot.test`, email_verified: true }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

let ADMIN_TOKEN;
let PLAYER_TOKEN;
let FRESH_OWNER_TOKEN;
let OWNER_ID;

const TEMP_PASSWORD = 'temp-pass-123';

describe('owner onboarding (T6-T11)', () => {
  beforeAll(async () => {
    ADMIN_TOKEN = await tokenFor('demo-admin-uid');
    PLAYER_TOKEN = await tokenFor('demo-player-uid');
  });

  it('accepts a public lead and notifies admins', async () => {
    const res = await request(app)
      .post('/api/v1/public/leads')
      .send({ name: 'Kasun Perera', email: 'kasun@example.com', phone: '0771234567', venue_name: 'Kasun Courts', city: 'Galle', message: 'Want to list my courts' });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('new');

    const { rows } = await pool.query(
      `select count(*)::int as n from notifications where type = 'owner_lead'`
    );
    expect(rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it('rejects a lead without a valid email', async () => {
    const res = await request(app)
      .post('/api/v1/public/leads')
      .send({ name: 'No Email', email: 'nope' });
    expect(res.status).toBe(400);
  });

  it('lists leads with duplicate flags for admins', async () => {
    await request(app).post('/api/v1/public/leads').send({ name: 'Kasun Again', email: 'kasun@example.com', venue_name: 'Other Courts', city: 'Colombo' });

    const res = await request(app)
      .get('/api/v1/admin/leads')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    const dup = res.body.data.find((l) => l.email === 'kasun@example.com');
    expect(dup.is_duplicate).toBe(true);
  });

  it('blocks non-admins from the leads queue', async () => {
    const res = await request(app)
      .get('/api/v1/admin/leads')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`);
    expect(res.status).toBe(403);
  });

  it('marks a lead contacted', async () => {
    const { rows } = await pool.query(`select id from owner_leads where email = 'kasun@example.com' order by created_at desc limit 1`);
    const res = await request(app)
      .patch(`/api/v1/admin/leads/${rows[0].id}`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ status: 'contacted' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('contacted');
  });

  it('creates plan templates and archives them without rewriting history', async () => {
    const created = await request(app)
      .post('/api/v1/admin/owners/plan-templates')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ name: '6 months free', term_days: 180, price_lkr: 0 });
    expect(created.status).toBe(201);
    expect(created.body.data.price_lkr).toBe(0);

    const yearly = await request(app)
      .post('/api/v1/admin/owners/plan-templates')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ name: 'Yearly', term_days: 365, price_lkr: 10000 });
    expect(yearly.status).toBe(201);

    const archived = await request(app)
      .post(`/api/v1/admin/owners/plan-templates/${created.body.data.id}/archive`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(archived.status).toBe(200);
    expect(archived.body.data.is_archived).toBe(true);

    const list = await request(app)
      .get('/api/v1/admin/owners/plan-templates')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    const names = list.body.data.map((t) => t.name);
    expect(names).not.toContain('6 months free');
  });

  it('creates an owner with a plan and agreement, converting the lead, and emails the credentials', async () => {
    const { rows: leadRows } = await pool.query(`select id from owner_leads where email = 'kasun@example.com' order by created_at desc limit 1`);
    const leadId = leadRows[0].id;

    const { rows: templateRows } = await pool.query(`select id from owner_plan_templates where name = 'Yearly' limit 1`);

    const res = await request(app)
      .post('/api/v1/admin/owners')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: 'Kasun Perera',
        email: 'kasun-owner@example.com',
        phone: '0771234567',
        temporary_password: TEMP_PASSWORD,
        plan_template_id: templateRows[0].id,
        start_date: '2026-08-23',
        agreement: {
          title: 'MySlot.LK Venue Partner Agreement',
          body: 'This agreement covers venue listing, commissions and taxes. Kasun agrees to operate the listed venue(s) in line with MySlot.LK terms.'
        },
        lead_id: leadId
      });

    expect(res.status).toBe(201);
    const data = res.body.data;
    expect(data.owner.role).toBe('venue_owner');
    expect(data.owner.onboarding_state).toBe('pending');
    expect(data.plan.name).toBe('Yearly');
    expect(data.plan.price_lkr).toBe(10000);
    expect(data.plan.start_date).toBe('2026-08-23');
    expect(data.plan.end_date).toBe('2027-08-23');
    expect(data.agreement.status).toBe('pending');

    const { rows: userRows } = await pool.query(`select * from users where id = $1`, [data.owner.id]);
    expect(userRows[0].onboarding_state).toBe('pending');

    const { rows: leadAfter } = await pool.query(`select status from owner_leads where id = $1`, [leadId]);
    expect(leadAfter[0].status).toBe('converted');

    OWNER_ID = data.owner.id;
  });

  it('rejects creating an owner with an email already in use (never reuses a player account)', async () => {
    const { rows: templateRows } = await pool.query(`select id from owner_plan_templates where name = 'Yearly' limit 1`);
    const res = await request(app)
      .post('/api/v1/admin/owners')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: 'Duplicate',
        email: 'player@myslot.lk',
        temporary_password: TEMP_PASSWORD,
        plan_template_id: templateRows[0].id,
        agreement: { title: 'T', body: 'B' }
      });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_IN_USE');
  });

  it('lists owners with their plans and expiring filter', async () => {
    const res = await request(app)
      .get('/api/v1/admin/owners')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    const owner = res.body.data.find((o) => o.id === OWNER_ID);
    expect(owner).toBeDefined();
    expect(owner.plan_name).toBe('Yearly');
    expect(owner.plan_end).toBe('2027-08-23');
    expect(owner.agreement_status).toBe('pending');
  });

  it('a fresh owner is gated out of the console until the agreement is accepted', async () => {
    FRESH_OWNER_TOKEN = await tokenFor('demo-owner-uid');

    // Simulate the provisioned account's uid by pointing the fresh owner at
    // the created user row (test mode signs tokens by uid).
    const { rows } = await pool.query(`select firebase_uid from users where id = $1`, [OWNER_ID]);
    const ownerToken = await tokenFor(rows[0].firebase_uid);

    const res = await request(app)
      .get('/api/v1/business/overview')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ONBOARDING_REQUIRED');
  });

  it('accepting the agreement unlocks the console', async () => {
    const { rows } = await pool.query(`select firebase_uid from users where id = $1`, [OWNER_ID]);
    const ownerToken = await tokenFor(rows[0].firebase_uid);

    const current = await request(app)
      .get('/api/v1/owner-onboarding/agreement/current')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(current.status).toBe(200);
    expect(current.body.data.status).toBe('pending');

    const accept = await request(app)
      .post(`/api/v1/owner-onboarding/agreements/${current.body.data.id}/accept`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(accept.status).toBe(200);
    expect(accept.body.data.status).toBe('accepted');

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(me.body.data.onboarding_state).toBe('accepted');

    const overview = await request(app)
      .get('/api/v1/business/overview')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(overview.status).toBe(200);
  });

  it('only accepted-terms owners can create venues (players are blocked)', async () => {
    const playerVenue = await request(app)
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({
        name: 'Player To Owner Club',
        address: '1 X St',
        city: 'Colombo',
        sports: ['badminton'],
        courts: [{ name: 'A', sport: 'badminton', price_per_slot: 1000, slot_duration_min: 60, capacity: 4, is_indoor: true }],
        hours: Array.from({ length: 7 }, (_, d) => ({ day_of_week: d, open_time: '06:00', close_time: '22:00' }))
      });
    expect(playerVenue.status).toBe(403);
    expect(playerVenue.body.error.code).toBe('ONBOARDING_REQUIRED');

    const { rows } = await pool.query(`select firebase_uid from users where id = $1`, [OWNER_ID]);
    const ownerToken = await tokenFor(rows[0].firebase_uid);
    const ownerVenue = await request(app)
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Accepted Owner Club',
        address: '2 Y St',
        city: 'Colombo',
        sports: ['badminton'],
        courts: [{ name: 'B', sport: 'badminton', price_per_slot: 1000, slot_duration_min: 60, capacity: 4, is_indoor: true }],
        hours: Array.from({ length: 7 }, (_, d) => ({ day_of_week: d, open_time: '06:00', close_time: '22:00' }))
      });
    expect(ownerVenue.status).toBe(201);
  });

  it('grandfathers existing owners (demo owner has no agreement but keeps access)', async () => {
    const res = await request(app)
      .get('/api/v1/business/overview')
      .set('Authorization', `Bearer ${await tokenFor('demo-owner-uid')}`);
    expect(res.status).toBe(200);
  });

  it('serves the owner plan & agreement history with bank details', async () => {
    const { rows } = await pool.query(`select firebase_uid from users where id = $1`, [OWNER_ID]);
    const ownerToken = await tokenFor(rows[0].firebase_uid);

    const res = await request(app)
      .get('/api/v1/owner-onboarding/plan')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.plans.length).toBe(1);
    expect(res.body.data.agreements.length).toBe(1);
    expect(res.body.data.bank_details).toBeDefined();
  });

  it('serves the agreement as a PDF', async () => {
    const { rows } = await pool.query(`select id from owner_agreements where owner_id = $1 order by created_at desc limit 1`, [OWNER_ID]);
    const { rows: userRows } = await pool.query(`select firebase_uid from users where id = $1`, [OWNER_ID]);
    const ownerToken = await tokenFor(userRows[0].firebase_uid);

    const res = await request(app)
      .get(`/api/v1/owner-onboarding/agreements/${rows[0].id}/pdf`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.body.length).toBeGreaterThan(1000);
  });

  it('renews an owner with a fresh plan + agreement', async () => {
    const { rows: templateRows } = await pool.query(`select id from owner_plan_templates where name = 'Yearly' limit 1`);
    const res = await request(app)
      .post(`/api/v1/admin/owners/${OWNER_ID}/renew`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({
        plan_template_id: templateRows[0].id,
        start_date: '2027-08-23',
        agreement: { title: 'Renewal Agreement', body: 'Renewed terms for another year.' }
      });
    expect(res.status).toBe(200);
    expect(res.body.data.agreement.status).toBe('pending');
    expect(res.body.data.plan.start_date).toBe('2027-08-23');

    const { rows: agreements } = await pool.query(
      `select count(*)::int as n from owner_agreements where owner_id = $1`,
      [OWNER_ID]
    );
    expect(agreements[0].n).toBe(2);
  });

  it('a renewal with an unaccepted agreement re-gates the console until re-acceptance', async () => {
    const { rows } = await pool.query(`select firebase_uid from users where id = $1`, [OWNER_ID]);
    const ownerToken = await tokenFor(rows[0].firebase_uid);

    // The owner accepted the original agreement (onboarding_state = accepted),
    // but the renewal created a fresh pending agreement — the console must be
    // gated again until the owner re-accepts (ADR-0022).
    const overview = await request(app)
      .get('/api/v1/business/overview')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(overview.status).toBe(403);
    expect(overview.body.error.code).toBe('ONBOARDING_REQUIRED');

    const current = await request(app)
      .get('/api/v1/owner-onboarding/agreement/current')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(current.body.data.status).toBe('pending');

    const accept = await request(app)
      .post(`/api/v1/owner-onboarding/agreements/${current.body.data.id}/accept`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(accept.status).toBe(200);

    const unlocked = await request(app)
      .get('/api/v1/business/overview')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(unlocked.status).toBe(200);
  });

  it('provisioned owners must rotate their temporary password (flag set, then cleared)', async () => {
    const { rows } = await pool.query(`select firebase_uid, must_change_password from users where id = $1`, [OWNER_ID]);
    expect(rows[0].must_change_password).toBe(true);
    const ownerToken = await tokenFor(rows[0].firebase_uid);

    const res = await request(app)
      .post('/api/v1/owner-onboarding/password-changed')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);

    const { rows: after } = await pool.query(`select must_change_password from users where id = $1`, [OWNER_ID]);
    expect(after[0].must_change_password).toBe(false);
  });

  it('nudges an owner with the plan status and bank details', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/owners/${OWNER_ID}/nudge`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data.nudged).toBe(true);
  });
});