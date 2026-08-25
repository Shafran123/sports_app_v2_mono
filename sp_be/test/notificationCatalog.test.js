const request = require('supertest');
const { SignJWT } = require('jose');
const app = require('../app');
const pool = require('../db');
const { dispatch, dispatchBooking, MESSAGES } = require('../utils/notificationCatalog');
const { enableLegacyFlags, resetFlagsToDefaults, enableSms } = require('./helpers/flags');

const secret = new TextEncoder().encode('test-secret');
const tokenFor = (uid) =>
  new SignJWT({ uid }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().sign(secret);

let PLAYER_ID;
let OWNER_ID;
let CASH_COURT_ID;

function colomboDate(daysFromNow) {
  const d = new Date(Date.now() + daysFromNow * 24 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function isoColombo(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00+05:30`;
}

describe('notification catalog', () => {
  beforeAll(async () => {
    await enableLegacyFlags();
    await enableSms();
    const { rows } = await pool.query(
      `select u.id, u.email, u.phone from users u where u.firebase_uid in ('demo-player-uid','demo-owner-uid')`
    );
    const player = rows.find((r) => r.email === 'player@myslot.lk');
    const owner = rows.find((r) => r.email === 'owner@myslot.lk');
    PLAYER_ID = player.id;
    OWNER_ID = owner.id;

    const ownerToken = await tokenFor('demo-owner-uid');
    const created = await request(app)
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Catalog Venue',
        address: '7 Catalog Ave',
        city: 'Colombo',
        accepts_cash: true,
        sports: ['badminton'],
        courts: [
          { name: 'Catalog Court', sport: 'badminton', price_per_slot: 1000, slot_duration_min: 60, capacity: 4, is_indoor: true }
        ],
        hours: Array.from({ length: 7 }, (_, d) => ({ day_of_week: d, open_time: '06:00', close_time: '23:00' }))
      });
    await request(app)
      .post(`/api/v1/admin/venues/${created.body.data.id}/approve`)
      .set('Authorization', `Bearer ${await tokenFor('demo-admin-uid')}`);
    const courtRows = await pool.query(`select id from courts where venue_id = $1`, [created.body.data.id]);
    CASH_COURT_ID = courtRows.rows[0].id;
  });

  beforeEach(async () => {
    await pool.query(`delete from outbound_messages`);
  });

  afterEach(() => {
    delete process.env.MAILGUN_API_KEY;
    delete process.env.MAILGUN_DOMAIN;
    delete process.env.SMSGO_API_KEY;
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await resetFlagsToDefaults();
  });

  it('rejects unknown keys without throwing', async () => {
    const res = await dispatch('no.such.key', {}, { awaitTransports: true });
    expect(res).toEqual([]);
  });

  it('registers the full message catalog', () => {
    for (const key of [
      'booking.confirmed',
      'booking.reminder',
      'booking.bill',
      'event.bill',
      'booking.cancelled.player',
      'booking.cancelled.owner',
      'booking.cancelled.admin',
      'booking.walkin_created',
      'event.registered',
      'event.cancelled',
      'signup.welcome',
      'venue.approved',
      'venue.rejected',
      'owner.welcome',
      'owner.renewal',
      'owner.nudge',
      'lead.new',
      'digest.daily'
    ]) {
      expect(MESSAGES[key]).toBeDefined();
    }
  });

  it('dispatches booking.confirmed to player in-app + player and owner outbox rows', async () => {
    const { rows: ownerRows } = await pool.query(`select * from users where id = $1`, [OWNER_ID]);
    const owner = ownerRows[0];
    const booking = {
      id: 'catalog-booking-1',
      user_id: PLAYER_ID,
      user_email: 'player@myslot.lk',
      player_phone: '+94771234567',
      user_phone: '+94771234567',
      venue_owner_id: OWNER_ID,
      owner_email: owner.email,
      owner_phone: owner.phone,
      venue_name: 'Catalog Venue',
      court_name: 'Catalog Court',
      start_at: '2026-09-01T04:30:00.000Z',
      end_at: '2026-09-01T05:30:00.000Z',
      total_price: 1500,
      payment_method: 'cash',
      status: 'confirmed'
    };

    await dispatch('booking.confirmed', { booking }, { awaitTransports: true });

    const notifs = await pool.query(
      `select * from notifications where user_id = $1 and type = 'booking_confirmed'`,
      [PLAYER_ID]
    );
    expect(notifs.rows.length).toBeGreaterThan(0);

    const out = await pool.query(
      `select * from outbound_messages where message_key = 'booking.confirmed' order by sent_at`
    );
    expect(out.rows.length).toBe(4);
    const emailRows = out.rows.filter((r) => r.channel === 'email');
    const smsRows = out.rows.filter((r) => r.channel === 'sms');
    expect(emailRows).toHaveLength(2);
    expect(smsRows).toHaveLength(2);
    expect(emailRows.map((r) => r.recipient).sort()).toEqual(['owner@myslot.lk', 'player@myslot.lk']);
    expect(smsRows.map((r) => r.recipient).sort()).toEqual(['+94700000002', '+94771234567']);
    expect(out.rows.every((r) => r.status === 'skipped')).toBe(true);
  });

  it('records sent when both providers accept', async () => {
    process.env.MAILGUN_API_KEY = 'mg-key';
    process.env.MAILGUN_DOMAIN = 'mg.example.com';
    process.env.SMSGO_API_KEY = 'sg-key';
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => '', json: async () => ({ success: true, data: { id: 'msg_sms' } }) })));

    const booking = {
      id: 'catalog-2',
      user_id: PLAYER_ID,
      user_email: 'player@myslot.lk',
      player_phone: '+94771234567',
      venue_owner_id: OWNER_ID,
      owner_email: 'owner@myslot.lk',
      owner_phone: '0700000002',
      venue_name: 'Catalog Venue',
      court_name: 'Catalog Court',
      start_at: '2026-09-01T04:30:00.000Z',
      end_at: '2026-09-01T05:30:00.000Z',
      total_price: 1500,
      payment_method: 'cash',
      status: 'confirmed'
    };

    await dispatch('booking.confirmed', { booking }, { awaitTransports: true });

    const out = await pool.query(
      `select * from outbound_messages where message_key = 'booking.confirmed' and recipient in ('player@myslot.lk','+94771234567','owner@myslot.lk','+94700000002') order by sent_at desc limit 4`
    );
    expect(out.rows.length).toBe(4);
    expect(out.rows.every((r) => r.status === 'sent')).toBe(true);
    const smsRows = out.rows.filter((r) => r.channel === 'sms');
    expect(smsRows.length).toBe(2);
    expect(smsRows.every((r) => r.provider_ref === 'msg_sms')).toBe(true);
  });

  it('a throwing transport never propagates and records failed', async () => {
    const spy = vi.spyOn(require('../utils/emailService'), 'sendEmail').mockImplementation(async () => {
      throw new Error('boom');
    });
    const booking = {
      id: 'catalog-3',
      user_id: PLAYER_ID,
      user_email: 'player@myslot.lk',
      player_phone: '+94771234567',
      venue_owner_id: OWNER_ID,
      owner_email: 'owner@myslot.lk',
      owner_phone: '+9470000002',
      venue_name: 'Catalog Venue',
      court_name: 'Catalog Court',
      start_at: '2026-09-01T04:30:00.000Z',
      end_at: '2026-09-01T05:30:00.000Z',
      total_price: 1500,
      payment_method: 'cash',
      status: 'confirmed'
    };

    const res = await dispatch('booking.confirmed', { booking }, { awaitTransports: true });
    expect(res.length).toBeGreaterThan(0);
    const failed = await pool.query(
      `select * from outbound_messages where message_key = 'booking.confirmed' and channel = 'email' and error = 'boom'`
    );
    expect(failed.rows.length).toBe(2);
    expect(failed.rows.every((r) => r.status === 'failed')).toBe(true);
    spy.mockRestore();
  });

  it('sms_events gate skips SMS for an excluded key but email still sends', async () => {
    await pool.query(
      `insert into platform_config (key, value, updated_at) values ('sms_events', '[]'::jsonb, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`
    );
    const booking = {
      id: 'catalog-4',
      user_id: PLAYER_ID,
      user_email: 'player@myslot.lk',
      player_phone: '+94771234567',
      user_phone: '+94771234567',
      venue_owner_id: OWNER_ID,
      venue_name: 'Catalog Venue',
      court_name: 'Catalog Court',
      start_at: '2026-09-01T04:30:00.000Z',
      end_at: '2026-09-01T05:30:00.000Z'
    };

    await dispatch('booking.reminder', { booking }, { awaitTransports: true });

    const sms = await pool.query(
      `select * from outbound_messages where message_key = 'booking.reminder' and channel = 'sms'`
    );
    expect(sms.rows).toHaveLength(1);
    expect(sms.rows[0].status).toBe('skipped');
    expect(sms.rows[0].error).toContain('sms_events');

    const email = await pool.query(
      `select * from outbound_messages where message_key = 'booking.reminder' and channel = 'email'`
    );
    expect(email.rows).toHaveLength(1);

    await pool.query(`delete from platform_config where key = 'sms_events'`);
  });

  it('lead.new fans out to every admin with an in-app row and email', async () => {
    await dispatch('lead.new', { lead: { name: 'Kasun', email: 'kasun@example.com', venue_name: 'Kasun Courts' } }, { awaitTransports: true });

    const notifs = await pool.query(
      `select count(*)::int as n from notifications where type = 'owner_lead'`
    );
    expect(notifs.rows[0].n).toBeGreaterThanOrEqual(1);

    const emails = await pool.query(
      `select count(*)::int as n from outbound_messages where message_key = 'lead.new' and channel = 'email'`
    );
    expect(emails.rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it('dispatchBooking loads a real booking and notifies both player and owner', async () => {
    const playerToken = await tokenFor('demo-player-uid');
    const date = colomboDate(4);
    const created = await request(app)
      .post('/api/v1/bookings/checkout')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({
        court_id: CASH_COURT_ID,
        start_at: isoColombo(date, '10:00'),
        end_at: isoColombo(date, '11:00'),
        payment_method: 'cash',
        idempotency_key: `catalog-dispatch-${Date.now()}`
      });
    expect(created.status).toBe(201);
    const bookingId = created.body.data.booking.id;

    await dispatchBooking('booking.confirmed', bookingId, {}, { awaitTransports: true });

    const { rows: notifs } = await pool.query(
      `select count(*)::int as n from notifications where user_id = $1 and type = 'booking_confirmed'`,
      [PLAYER_ID]
    );
    expect(notifs[0].n).toBeGreaterThan(0);

    const out = await pool.query(
      `select * from outbound_messages where message_key = 'booking.confirmed' and recipient in ('player@myslot.lk','owner@myslot.lk')`
    );
    expect(out.rows.filter((r) => r.recipient === 'owner@myslot.lk').length).toBe(2);
  });
});