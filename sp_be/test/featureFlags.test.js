const request = require('supertest');
const { SignJWT } = require('jose');
const app = require('../app');
const pool = require('../db');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid) =>
  new SignJWT({ uid }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

let PLAYER_TOKEN;
let ADMIN_TOKEN;

async function resetFlag(key, value) {
  await pool.query(
    `insert into platform_config (key, value, updated_at) values ($1, $2, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [key, JSON.stringify(value)]
  );
}

describe('feature flags', () => {
  beforeAll(async () => {
    PLAYER_TOKEN = await tokenFor('demo-player-uid');
    ADMIN_TOKEN = await tokenFor('demo-admin-uid');
    // Other suites enable flags for their legacy scenarios; this suite
    // asserts the registry defaults, so start from a clean slate.
    const { resetFlagsToDefaults } = require('./helpers/flags');
    await resetFlagsToDefaults();
  });

  it('serves public flags with defaults unauthenticated', async () => {
    const res = await request(app).get('/api/v1/public/feature-flags');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      phone_verification_required: false,
      sms_enabled: false,
      payhere_enabled: false,
      events_discovery_state: 'enabled'
    });
  });

  it('lets an admin read config with flag metadata and tax rate', async () => {
    const res = await request(app)
      .get('/api/v1/admin/config')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(200);
    const { flags, tax_rate } = res.body.data;
    expect(flags.find((f) => f.name === 'events_discovery_state')).toMatchObject({
      type: 'enum',
      values: ['enabled', 'coming_soon', 'hidden']
    });
    expect(flags.find((f) => f.name === 'phone_verification_required').type).toBe('boolean');
    expect(tax_rate).toBe(0);
  });

  it('rejects a player from reading or mutating config', async () => {
    const read = await request(app)
      .get('/api/v1/admin/config')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`);
    expect(read.status).toBe(403);

    const write = await request(app)
      .put('/api/v1/admin/config/flags/sms_enabled')
      .set('Authorization', `Bearer ${PLAYER_TOKEN}`)
      .send({ value: true });
    expect(write.status).toBe(403);
  });

  it('admins can flip a boolean flag; public endpoint reflects it', async () => {
    await resetFlag('phone_verification_required', false);

    const res = await request(app)
      .put('/api/v1/admin/config/flags/phone_verification_required')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ value: true });
    expect(res.status).toBe(200);
    expect(res.body.data.value).toBe(true);

    const pub = await request(app).get('/api/v1/public/feature-flags');
    expect(pub.body.data.phone_verification_required).toBe(true);
    await resetFlag('phone_verification_required', false);
  });

  it('accepts string forms of booleans', async () => {
    const res = await request(app)
      .put('/api/v1/admin/config/flags/payhere_enabled')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ value: 'true' });
    expect(res.status).toBe(200);
    expect(res.body.data.value).toBe(true);
    await resetFlag('payhere_enabled', false);
  });

  it('rejects invalid enum values for events_discovery_state', async () => {
    const res = await request(app)
      .put('/api/v1/admin/config/flags/events_discovery_state')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ value: 'party_mode' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_VALUE');
  });

  it('rejects unknown config keys', async () => {
    const res = await request(app)
      .put('/api/v1/admin/config/flags/not_a_real_flag')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ value: true });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('UNKNOWN_CONFIG');
  });

  it('records an audit trail with admin identity on change', async () => {
    await resetFlag('payhere_enabled', false);
    await request(app)
      .put('/api/v1/admin/config/flags/payhere_enabled')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ value: true });

    const { rows } = await pool.query(
      `select * from flag_audits where key = 'payhere_enabled' order by changed_at desc limit 1`
    );
    expect(rows.length).toBe(1);
    expect(rows[0].new_value).toBe(true);
    expect(rows[0].old_value).toBe(false);
    expect(rows[0].admin_id).toBeTruthy();

    const audit = await request(app)
      .get('/api/v1/admin/config/audit')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(audit.status).toBe(200);
    const top = audit.body.data[0];
    expect(top.key).toBe('payhere_enabled');
    expect(top.admin_name).toBe('Demo Admin');
    await resetFlag('payhere_enabled', false);
  });

  it('validates and persists the tax rate', async () => {
    const bad = await request(app)
      .put('/api/v1/admin/config/flags/tax_rate')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ value: 250 });
    expect(bad.status).toBe(400);

    const ok = await request(app)
      .put('/api/v1/admin/config/flags/tax_rate')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ value: 12 });
    expect(ok.status).toBe(200);
    expect(ok.body.data.value).toBe(12);

    const cfg = await request(app)
      .get('/api/v1/admin/config')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
    expect(cfg.body.data.tax_rate).toBe(12);
    await resetFlag('tax_rate', 0);
  });
});