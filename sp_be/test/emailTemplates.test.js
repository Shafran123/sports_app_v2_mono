const {
  shell,
  buildBookingHtml,
  buildReminderHtml,
  buildBillHtml,
  buildOwnerBookingHtml,
  buildVenueApprovedHtml,
  buildEventRegisteredHtml,
  escapeHtml,
  brandWordmark,
  brandHeader,
  themeFor
} = require('../utils/emailTemplates');

const booking = {
  id: 'b1',
  user_email: 'player@spots.lk',
  player_name: 'Kasun Perera',
  venue_name: 'Smash Arena',
  court_name: 'Court 1',
  venue_city: 'Colombo',
  venue_phone: '0112223344',
  start_at: '2026-09-01T04:30:00.000Z',
  end_at: '2026-09-01T05:30:00.000Z',
  total_price: 1500,
  payment_method: 'cash',
  status: 'confirmed'
};

const QR_OPTS = { qr: { cid: 'booking-qr.png' } };

describe('email templates (prod-grade shell)', () => {
  it('shell renders doctype, hidden preheader, dark-mode block and optional CTA', () => {
    const html = shell({
      brand: 'MySlot.LK',
      preheader: 'Your booking is confirmed',
      content: '<p>body</p>',
      ctaText: 'View booking',
      ctaHref: 'https://spots.lk/bookings/b1'
    });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('display:none;max-height:0;overflow:hidden;mso-hide:all');
    expect(html).toContain('@media (prefers-color-scheme: dark)');
    expect(html).toContain('https://spots.lk/bookings/b1');
    expect(html).toContain('View booking');
  });

  it('wordmark is two-tone from the brand config', () => {
    const mark = brandWordmark('MySlot.LK');
    expect(mark).toContain('MySlot');
    expect(mark).toContain('.LK');
    expect(mark).toContain('#16a34a');
  });

  it('booking confirmation carries venue contact + plain-text + CTA deep link', () => {
    const built = buildBookingHtml(booking);
    expect(built.html).toContain('Smash Arena');
    expect(built.html).toContain('0112223344');
    expect(built.html).toContain('Colombo');
    expect(built.html).toContain('/bookings/b1');
    expect(built.text).toContain('Smash Arena');
    expect(built.preheader).toContain('Smash Arena');
  });

  it('confirmation/reminder/bill embed the inline QR when opts.qr is passed', () => {
    for (const builder of [buildBookingHtml, buildReminderHtml, buildBillHtml]) {
      const withQr = builder(booking, 'MySlot.LK', QR_OPTS);
      expect(withQr.html).toContain('cid:booking-qr.png');
      expect(withQr.html).toContain("don't forward this email");
      expect(withQr.attachment.inline).toBe(true);
      expect(withQr.attachment.filename).toBe('booking-qr.png');

      const withoutQr = builder(booking, 'MySlot.LK');
      expect(withoutQr.html).not.toContain('cid:booking-qr.png');
      expect(withoutQr.attachment).toBeFalsy();
    }
  });

  it('owner-facing booking email never contains the player QR', () => {
    const built = buildOwnerBookingHtml(booking);
    expect(built.html).not.toContain('cid:');
    expect(built.html).not.toContain('qr_token');
    expect(built.html).toContain('Open console');
  });

  it('venue approval renders the branded shell with brand quoted text', () => {
    const built = buildVenueApprovedHtml({ name: 'Smash Arena' });
    expect(built.html).toContain('Smash Arena');
    expect(built.text).toContain('Smash Arena');
  });

  it('event registration has no QR block (no check-in token for events)', () => {
    const built = buildEventRegisteredHtml({ event_name: 'Social', event_start: '2026-09-01T04:30:00.000Z' });
    expect(built.html).not.toContain('cid:');
    expect(built.html).toContain('Social');
  });

  it('escapeHtml neutralises script-bearing input', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).not.toContain('<img');
    expect(escapeHtml('a & b')).toContain('a &amp; b');
  });

  it('brand name from config is escaped into the shell', () => {
    const html = shell({ brand: 'A & B <img>' });
    expect(html).not.toContain('<img>');
    expect(html).toContain('A &amp; B');
    // The footer escapes once — never double-escapes the ampersand.
    expect(html).toContain('A &amp; B &lt;img&gt; — book courts');
    expect(html).not.toContain('&amp;amp;');
  });

  it('business tokens theme the header logo, CTA, badge and keep the platform footer (brand-consolidation 04)', () => {
    const tokens = {
      logo_url: 'https://cdn.test/smash-logo.png',
      primary: '#0f766e',
      accent: '#b45309',
      platform: 'MySlot.LK'
    };
    const built = buildBookingHtml(booking, 'Smash Arena Sports', { tokens });
    expect(built.html).toContain('https://cdn.test/smash-logo.png');
    expect(built.html).toContain('Smash Arena Sports');
    // CTA filled with the Business primary, footer still attributes the platform.
    expect(built.html).toContain('background:#0f766e');
    expect(built.html).toContain('MySlot.LK — book courts, join games, find players.');
    expect(built.html).not.toContain('Smash Arena Sports — book courts, join games, find players.');
  });

  it('falls back to the wordmark in Business primary when the Business has no logo (brand-consolidation 04)', () => {
    const tokens = { primary: '#7c3aed', accent: '#2563eb', platform: 'MySlot.LK' };
    const built = buildBookingHtml(booking, 'Smash Arena Sports', { tokens });
    expect(built.html).not.toContain('<img');
    expect(built.html).toContain('#7c3aed');
    expect(built.html).toContain('Smash Arena Sports');
    expect(built.html).toContain('MySlot.LK — book courts, join games, find players.');
  });

  it('event registration badge is tinted from the Business primary (brand-consolidation 04)', () => {
    const tokens = { primary: '#0f766e', accent: '#b45309', platform: 'MySlot.LK' };
    const built = buildEventRegisteredHtml({ event_name: 'Social', event_start: '2026-09-01T04:30:00.000Z' }, 'Smash Arena Sports', { tokens });
    expect(built.html).toContain('Registered');
    expect(built.html).toContain(themeFor(tokens).badgeBg);
  });

  it('brandHeader renders the logo image when set, else the themed wordmark', () => {
    const withLogo = brandHeader('Smash Arena Sports', themeFor({ logo_url: 'https://cdn.test/l.png', primary: '#0f766e', platform: 'MySlot.LK' }));
    expect(withLogo).toContain('<img');
    expect(withLogo).toContain('https://cdn.test/l.png');
    const without = brandHeader('Smash Arena Sports', themeFor({ primary: '#0f766e', platform: 'MySlot.LK' }));
    expect(without).not.toContain('<img');
    expect(without).toContain('#0f766e');
  });
});