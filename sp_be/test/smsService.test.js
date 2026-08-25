const { sendSms, formatSriLankanPhone, buildBookingSms } = require('../utils/smsService');
const pool = require('../db');
const { enableSms, resetFlagsToDefaults } = require('./helpers/flags');

describe('sms service', () => {
  beforeAll(async () => {
    // These tests exercise the transport itself; enable the sms_enabled flag
    // so the feature gate (tested in flagsGates.test.js / featureFlags.test.js)
    // does not short-circuit them.
    await enableSms();
  });

  afterEach(() => {
    delete process.env.SMSGO_API_KEY;
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await resetFlagsToDefaults();
  });

  it('is a no-op when SMSGo is not configured', async () => {
    const result = await sendSms({ to: '94771234567', message: 'hi' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('SMS not configured');
  });

  it('normalises Sri Lankan numbers to E.164', () => {
    expect(formatSriLankanPhone('0771234567')).toBe('+94771234567');
    expect(formatSriLankanPhone('+94 77 123 4567')).toBe('+94771234567');
    expect(formatSriLankanPhone('94771234567')).toBe('+94771234567');
  });

  it('builds a booking confirmation message', () => {
    const msg = buildBookingSms({
      venue_name: 'Smash Arena',
      court_name: 'Court 1',
      start_at: '2026-08-22T04:30:00.000Z',
      total_price: 1500,
      payment_method: 'cash'
    });
    expect(msg).toContain('Smash Arena');
    expect(msg).toContain('Court 1');
  });

  it('posts to the SMSGo API when configured', async () => {
    process.env.SMSGO_API_KEY = 'sg_live_test';
    process.env.SMSGO_MASK = 'SPOTS';
    const posted = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({ success: true, data: { id: 'msg_test_123', status: 'sent' } })
    }));
    vi.stubGlobal('fetch', posted);

    const result = await sendSms({ to: '+94771234567', message: 'Your booking is confirmed.' });

    expect(result.success).toBe(true);
    expect(result.id).toBe('msg_test_123');
    const [url, opts] = posted.mock.calls[0];
    expect(url).toBe('https://api.smsgo.lk/api/v1/sms/send');
    expect(opts.method).toBe('POST');
    expect(opts.headers['X-API-Key']).toBe('sg_live_test');
    const body = JSON.parse(opts.body);
    expect(body.to).toBe('94771234567');
    expect(body.mask).toBe('SPOTS');
    expect(body.message).toContain('Your booking is confirmed.');
  });

  it('still sends when the provider returns no JSON body', async () => {
    process.env.SMSGO_API_KEY = 'sg_live_test';
    const posted = vi.fn(async () => ({ ok: true, status: 200, text: async () => '' }));
    vi.stubGlobal('fetch', posted);

    const result = await sendSms({ to: '94771234567', message: 'hello' });

    expect(result.success).toBe(true);
    expect(result.id).toBeNull();
  });
});