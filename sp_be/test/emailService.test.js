const { sendEmail, buildBookingHtml } = require('../utils/emailService');

describe('email service', () => {
  afterEach(() => {
    delete process.env.MAILGUN_API_KEY;
    delete process.env.MAILGUN_DOMAIN;
  });

  it('is a no-op when Mailgun is not configured', async () => {
    const result = await sendEmail({ to: 'a@b.c', subject: 'Hi', html: '<p>Hi</p>' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Email not configured');
  });

  it('builds a booking confirmation body with the key details', () => {
    const { html, text } = buildBookingHtml({
      venue_name: 'Smash Arena',
      court_name: 'Court 1',
      start_at: '2026-08-22T04:30:00.000Z',
      end_at: '2026-08-22T05:30:00.000Z',
      total_price: 1500,
      payment_method: 'cash'
    });
    expect(html).toContain('Smash Arena');
    expect(html).toContain('Court 1');
    expect(html).toContain('LKR 1,500');
    expect(html).toContain('QR');
    expect(text).toContain('Smash Arena');
  });

  it('escapes user-sourced strings so HTML injection is inert', () => {
    const { html } = buildBookingHtml({
      venue_name: '<img src=x onerror=alert(1)>',
      court_name: 'Court & "1"',
      start_at: '2026-08-22T04:30:00.000Z',
      end_at: '2026-08-22T05:30:00.000Z',
      total_price: 1500,
      payment_method: 'cash'
    });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
    expect(html).toContain('Court &amp;');
  });

  it('posts a message to the Mailgun API when configured', async () => {
    process.env.MAILGUN_API_KEY = 'test-key';
    process.env.MAILGUN_DOMAIN = 'mg.example.com';
    const posted = vi.fn(async () => ({ ok: true, status: 200, text: async () => '' }));
    vi.stubGlobal('fetch', posted);

    const result = await sendEmail({ to: 'dev@spots.app', subject: 'Booking confirmed', html: '<p>hi</p>' });

    expect(result.success).toBe(true);
    const [url, opts] = posted.mock.calls[0];
    expect(url).toBe('https://api.mailgun.net/v3/mg.example.com/messages');
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toContain('Basic');
    expect(String(opts.body)).toContain('subject=Booking+confirmed');
    expect(String(opts.body)).toContain('to=dev%40spots.app');
  });
});