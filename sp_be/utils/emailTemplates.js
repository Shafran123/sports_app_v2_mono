const { fmtWhen, fmtLkr } = require('./format');

// ADR-0005 light-premium tokens (paper/ink/court-green) implemented as inline
// styles — the only style mechanism every mail client honours. Table-based
// layout for Outlook; no web fonts (stripped by Gmail/Outlook).
const C = {
  paper: '#fafaf7',
  surface: '#ffffff',
  surface2: '#f4f4f0',
  ink: '#0e1512',
  ink2: '#4b5563',
  ink3: '#9ca3af',
  border: '#e7eae5',
  primary: '#16a34a',
  primaryDark: '#15803d',
  primaryLight: '#dcfce7',
  accent: '#2563eb',
  accentLight: '#dbeafe',
  warning: '#b45309',
  error: '#dc2626',
  errorLight: '#fee2e2'
};

// Forced-dark counter-styles (grill Q9: dedicated dark mode in v1).
function darkStyleBlock() {
  return `<style>
    @media (prefers-color-scheme: dark) {
      .ms-body, .ms-shell { background-color: #10150f !important; }
      .ms-card { background-color: #18211a !important; }
      .ms-surface2 { background-color: #22301f !important; }
      .ms-border { border-color: #2a3a30 !important; }
      .ms-ink { color: #eef5ec !important; }
      .ms-ink2, .ms-muted { color: #aab7ad !important; }
      .ms-badge { background-color: #22301f !important; }
      .ms-badge-text { color: #6ee7a1 !important; }
      .ms-footer { border-top-color: #2a3a30 !important; }
    }
    @media only screen and (max-width: 600px) {
      .ms-shell { width: 100% !important; }
      .ms-pad { padding: 16px !important; }
    }
  </style>`;
}

// Escape any user-sourced string before it lands in an HTML email template.
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---- Business-brand theming (brand-consolidation ticket 04) ----
// Booking/event/site emails can carry the Business's own colors + logo via a
// `tokens` object ({ logo_url, primary, accent, platform }). Surfaces and ink
// stay neutral regardless — only accents, the CTA, badges and the header
// brand get the Business colors.

function hexRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Mix hex toward another hex by t (0..1). Used to derive readable badge tints
// from an arbitrary Business primary color.
function mixHex(a, b, t) {
  const ra = hexRgb(a);
  const rb = hexRgb(b);
  if (!ra || !rb) return C.primary;
  return `#${ra
    .map((v, i) => Math.round(v + (rb[i] - v) * t).toString(16).padStart(2, '0'))
    .join('')}`;
}

// The accent palette derived from the Business brand tokens, falling back to
// the platform defaults when tokens are absent.
function themeFor(tokens) {
  const t = tokens || null;
  const primary = t?.primary || C.primary;
  return {
    primary,
    accent: t?.accent || C.accent,
    badgeBg: mixHex(primary, '#ffffff', 0.86),
    badgeFg: mixHex(primary, '#000000', 0.32),
    logoUrl: t?.logo_url || '',
    platform: t?.platform || ''
  };
}

const DEFAULT_BRAND = 'MySlot.LK';

// Two-tone wordmark from the brand config ("MySlot.LK" -> ink "MySlot" + the
// brand's primary ".LK"). Used as the header when the Business has no logo.
function brandWordmark(brand = DEFAULT_BRAND, primary = C.primary) {
  const name = String(brand || DEFAULT_BRAND);
  const dot = name.lastIndexOf('.');
  if (dot > 0 && dot < name.length - 1) {
    return `<span style="color:${C.ink};font-weight:800;">${escapeHtml(name.slice(0, dot))}</span><span style="color:${primary};font-weight:800;">${escapeHtml(name.slice(dot))}</span>`;
  }
  return `<span style="color:${primary};font-weight:800;">${escapeHtml(name)}</span>`;
}

// The header brand block: the Business's logo image when set, else the
// wordmark recolored to the Business primary.
function brandHeader(brand, theme) {
  if (theme.logoUrl) {
    const alt = escapeHtml(brand);
    const src = escapeHtml(theme.logoUrl);
    return `<img src="${src}" alt="${alt}" width="160" style="max-width:160px;max-height:44px;display:block;object-fit:contain;border:0;">`;
  }
  return brandWordmark(brand, theme.primary);
}

function preheaderBlock(preheader) {
  if (!preheader) return '';
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.paper};">${escapeHtml(preheader)}</div>`;
}

// Bulletproof CTA: VML rounded rect for Outlook, normal anchor for everyone else.
// Filled with the Business primary when business-branded.
function ctaButton(text, href, primary = C.primary) {
  const safeHref = escapeHtml(href);
  const safeText = escapeHtml(text);
  return `<!--[if mso]>
  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:44px;v-text-anchor:middle;width:240px;" arcsize="50%" strokecolor="${primary}" fillcolor="${primary}">
    <w:anchorlock/>
    <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:700;">${safeText}</center>
  </v:roundrect>
  <![endif]-->
  <a href="${safeHref}" style="display:inline-block;background:${primary};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 28px;border-radius:999px;mso-hide:all;">${safeText}</a>`;
}

function appBase() {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

function consoleBase() {
  return (process.env.CONSOLE_URL || appBase()).replace(/\/+$/, '');
}

function venueRow(booking) {
  const parts = [booking?.venue_name, booking?.venue_city, booking?.venue_phone].filter(Boolean);
  if (!booking?.venue_name) return '';
  return `<p class="ms-muted" style="margin:0;color:${C.ink2};font-size:13px;">${escapeHtml(parts.join(' · '))}</p>`;
}

// Booking summary card shared by player + owner builders.
function bookingCard(booking, accent = C.primaryLight) {
  const label = booking.payment_method === 'cash' ? 'Pay at venue' : 'Paid online';
  const player = booking.player_name ? `<p class="ms-ink" style="margin:0;color:${C.ink};font-size:14px;font-weight:700;">${escapeHtml(booking.player_name)}</p>` : '';
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="ms-card" style="border-collapse:collapse;background:${C.surface};border:1px solid ${C.border};border-radius:16px;">
      <tr>
        <td class="ms-pad" style="padding:20px 24px;border-radius:16px;">
          <p class="ms-ink" style="margin:0 0 4px;color:${C.ink};font-size:17px;font-weight:800;">${escapeHtml(booking.venue_name || 'Venue')} — ${escapeHtml(booking.court_name || '')}</p>
          ${venueRow(booking)}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:14px;">
            <tr>
              <td style="padding:4px 0;"><span class="ms-muted" style="color:${C.ink2};font-size:13px;">When</span></td>
              <td align="right" class="ms-ink" style="color:${C.ink};font-size:14px;font-weight:700;">${fmtWhen(booking.start_at)} — ${fmtWhen(booking.end_at)}</td>
            </tr>
            ${booking.total_price != null ? `<tr>
              <td style="padding:4px 0;"><span class="ms-muted" style="color:${C.ink2};font-size:13px;">Total</span></td>
              <td align="right" class="ms-ink" style="color:${C.ink};font-size:14px;font-weight:700;">${fmtLkr(booking.total_price)}</td>
            </tr>` : ''}
            ${booking.payment_method ? `<tr>
              <td style="padding:4px 0;"><span class="ms-muted" style="color:${C.ink2};font-size:13px;">Payment</span></td>
              <td align="right" class="ms-ink" style="color:${C.ink};font-size:14px;font-weight:700;">${label}</td>
            </tr>` : ''}
            ${booking.status ? `<tr>
              <td style="padding:4px 0;"><span class="ms-muted" style="color:${C.ink2};font-size:13px;">Status</span></td>
              <td align="right" class="ms-ink" style="color:${C.ink};font-size:14px;font-weight:700;">${escapeHtml(booking.status)}</td>
            </tr>` : ''}
            ${player ? `<tr>
              <td style="padding:4px 0;"><span class="ms-muted" style="color:${C.ink2};font-size:13px;">Player</span></td>
              <td align="right" class="ms-ink" style="color:${C.ink};font-size:14px;font-weight:700;">${player}</td>
            </tr>` : ''}
          </table>
        </td>
      </tr>
    </table>`;
}

// QR block: inline CID image + single-use microcopy.
function qrBlock(qr, token = null) {
  if (!qr) return '';
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="border-collapse:collapse;margin:0 auto;">
      <tr>
        <td class="ms-card" style="background:${C.surface};border:1px solid ${C.border};border-radius:16px;padding:16px;" align="center">
          <p class="ms-ink" style="margin:0 0 10px;color:${C.ink};font-size:14px;font-weight:700;">Your check-in code</p>
          <img src="cid:${qr.cid}" width="160" height="160" alt="Booking QR code" style="display:block;width:160px;height:160px;border:0;">
          <p class="ms-muted" style="margin:10px 0 0;color:${C.ink2};font-size:12px;line-height:1.4;">${token ? '' : ''}Single-use check-in code — don't forward this email.</p>
        </td>
      </tr>
    </table>`;
}

// Plain-text alternative derived from the same content.
function plainLines(...lines) {
  return lines.filter(Boolean).join('\n') + '\n';
}

const footerLine = (brand) => `${brand} — book courts, join games, find players.\nYou received this because of an activity on your account.`;

/**
 * Reference blocks that mutate with a light built-in badge.
 */
function badge(text, bg = C.primaryLight, fg = C.primaryDark) {
  return `<span class="ms-badge" style="display:inline-block;background:${bg};color:${fg};border-radius:999px;padding:4px 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;">${escapeHtml(text)}</span>`;
}

/**
 * The shared prod-grade shell (ADR-0005). Table-based for Outlook, inline
 * styled, forced-dark styles, preheader, optional CTA and venue contact.
 * `tokens` ({ logo_url, primary, accent, platform }) themes the header brand,
 * CTA and badges to the Business; the footer always attributes the platform.
 */
function shell({ brand = DEFAULT_BRAND, tokens, preheader, content, ctaText, ctaHref, plainText, dark = true } = {}) {
  const theme = themeFor(tokens);
  const safeBrand = escapeHtml(brand);
  // The footer always attributes the platform when business-branded (tokens
  // carry the platform name); otherwise it attributes the brand itself.
  const footerBrand = theme.platform || brand;
  const cta = ctaText && ctaHref ? `
      <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="border-collapse:collapse;margin:24px auto 0;">
        <tr><td align="center">${ctaButton(ctaText, ctaHref, theme.primary)}</td></tr>
      </table>` : '';
  const plain = plainText ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.paper};">${escapeHtml(plainText).slice(0, 200)}</div>` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${safeBrand}</title>
${dark ? darkStyleBlock() : ''}
</head>
<body class="ms-body" style="margin:0;padding:0;background:${C.paper};font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
${preheaderBlock(preheader)}
${plain}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${C.paper};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="ms-shell" style="border-collapse:collapse;width:600px;max-width:600px;background:${C.surface};border-radius:24px;border:1px solid ${C.border};">
        <tr>
          <td style="padding:28px 32px 8px;">
            <p style="margin:0;font-size:24px;letter-spacing:-0.5px;">${brandHeader(brand, theme)}</p>
          </td>
        </tr>
        <tr>
          <td class="ms-pad" style="padding:16px 32px 32px;">
            ${content}
            ${cta}
          </td>
        </tr>
        <tr>
          <td class="ms-footer" style="padding:16px 32px 28px;border-top:1px solid ${C.border};">
            <p class="ms-muted" style="margin:0;color:${C.ink2};font-size:12px;line-height:1.6;text-align:center;">${escapeHtml(footerBrand)} — book courts, join games, find players.<br>This is a transactional message about your account.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ---- QR PNG generation (qrcode lib already a sp_be dependency) ----
async function qrPng(token, width = 160) {
  const QRCode = require('qrcode');
  return QRCode.toBuffer(token, { width, margin: 1 });
}

// ---- Builders ----

function buildBookingHtml(booking, brand = DEFAULT_BRAND, opts = {}) {
  const th = themeFor(opts.tokens);
  const venue = booking?.venue_name || '';
  const what = venue ? `at ${venue}` : 'is booked';
  const preheader = `Your slot ${what} — ${fmtWhen(booking?.start_at)}. Show this QR at check-in.`;
  const text = plainLines(
    `Booking confirmed — ${booking?.venue_name || ''}`,
    `${booking?.court_name || ''}`,
    `When: ${fmtWhen(booking?.start_at)} — ${fmtWhen(booking?.end_at)}`,
    booking?.total_price != null ? `Total: ${fmtLkr(booking.total_price)}` : '',
    `Payment: ${booking?.payment_method === 'cash' ? 'Pay at venue' : 'Paid online'}`,
    '',
    'Show the QR code at the venue to check in.',
    '',
    footerLine(brand)
  );
  return {
    preheader,
    text,
    html: shell({
      brand,
      tokens: opts.tokens,
      preheader,
      content: `
        <h1 class="ms-ink" style="margin:0 0 8px;color:${C.ink};font-size:22px;font-weight:800;line-height:1.25;">Your slot is booked</h1>
        <p class="ms-ink2" style="margin:0 0 20px;color:${C.ink2};font-size:15px;">Show the QR code at the venue to check in.</p>
        ${badge('Confirmed', th.badgeBg, th.badgeFg)}
        ${bookingCard(booking)}
        ${qrBlock(opts.qr || null)}
        <p class="ms-muted" style="margin:6px 0 0;color:${C.ink2};font-size:12px;">Also in the app under Bookings.</p>`,
      ctaText: opts.ctaText || 'View booking',
      ctaHref: opts.ctaHref || `${appBase()}/bookings/${booking?.id || ''}`,
      plainText: text
    }),
    attachment: opts.qr
      ? { filename: 'booking-qr.png', content: null, contentType: 'image/png', inline: true, qrOpts: opts.qr }
      : null
  };
}

function buildOwnerBookingHtml(booking, brand = DEFAULT_BRAND, opts = {}) {
  const th = themeFor(opts.tokens);
  const preheader = `A new booking at ${booking?.venue_name || 'your venue'} — ${fmtWhen(booking?.start_at)}.`;
  const text = plainLines(
    `New booking — ${booking?.venue_name || ''}`,
    `${booking?.court_name || ''}`,
    `When: ${fmtWhen(booking?.start_at)} — ${fmtWhen(booking?.end_at)}`,
    booking?.total_price != null ? `Total: ${fmtLkr(booking.total_price)}` : '',
    `Payment: ${booking?.payment_method === 'cash' ? 'Pay at venue' : 'Paid online'}`,
    booking?.player_name ? `Player: ${booking.player_name}` : '',
    '',
    'Manage this booking from your venue console.',
    '',
    footerLine(brand)
  );
  return {
    preheader,
    text,
    html: shell({
      brand,
      tokens: opts.tokens,
      preheader,
      content: `
        <h1 class="ms-ink" style="margin:0 0 8px;color:${C.ink};font-size:22px;font-weight:800;line-height:1.25;">New booking at your venue</h1>
        <p class="ms-ink2" style="margin:0 0 20px;color:${C.ink2};font-size:15px;">Ready for the next player.</p>
        ${badge('New booking', th.badgeBg, th.badgeFg)}
        ${bookingCard(booking)}`,
      ctaText: 'Open console',
      ctaHref: `${consoleBase()}`,
      plainText: text
    })
  };
}

// Awaiting-confirmation copy (ADR-0040): sent to the player when their booking
// lands `pending` (Business has auto-confirm off). No QR yet — the player
// hasn't been confirmed, so nothing is checkable.
function buildPendingBookingHtml(booking, brand = DEFAULT_BRAND, opts = {}) {
  const th = themeFor(opts.tokens);
  const preheader = `We've received your booking request at ${booking?.venue_name || 'the venue'} — awaiting confirmation.`;
  const text = plainLines(
    `Booking received — awaiting confirmation`,
    `${booking?.venue_name || ''} — ${booking?.court_name || ''}`,
    `When: ${fmtWhen(booking?.start_at)} — ${fmtWhen(booking?.end_at)}`,
    booking?.total_price != null ? `Total: ${fmtLkr(booking.total_price)}` : '',
    `Payment: ${booking?.payment_method === 'cash' ? 'Pay at venue' : 'Paid online'}`,
    '',
    'The venue will confirm shortly. You can cancel this request any time.',
    '',
    footerLine(brand)
  );
  return {
    preheader,
    text,
    html: shell({
      brand,
      tokens: opts.tokens,
      preheader,
      content: `
        <h1 class="ms-ink" style="margin:0 0 8px;color:${C.ink};font-size:22px;font-weight:800;line-height:1.25;">Booking received</h1>
        <p class="ms-ink2" style="margin:0 0 20px;color:${C.ink2};font-size:15px;">The venue is confirming your slot — we'll email you the moment it's confirmed.</p>
        ${badge('Awaiting confirmation', th.badgeBg, th.badgeFg)}
        ${bookingCard(booking)}`,
      ctaText: 'View booking',
      ctaHref: `${appBase()}/bookings/${booking?.id || ''}`,
      plainText: text
    })
  };
}

function buildReminderHtml(booking, brand = DEFAULT_BRAND, opts = {}) {
  const th = themeFor(opts.tokens);
  const preheader = `Reminder: your booking at ${booking?.venue_name || ''} is tomorrow — ${fmtWhen(booking?.start_at)}.`;
  const text = plainLines(
    `Reminder — your booking is coming up`,
    `${booking?.venue_name || ''} — ${booking?.court_name || ''}`,
    `When: ${fmtWhen(booking?.start_at)} — ${fmtWhen(booking?.end_at)}`,
    '',
    'Please arrive a few minutes early. Have your QR code ready to check in.',
    '',
    footerLine(brand)
  );
  return {
    preheader,
    text,
    html: shell({
      brand,
      tokens: opts.tokens,
      preheader,
      content: `
        <h1 class="ms-ink" style="margin:0 0 8px;color:${C.ink};font-size:22px;font-weight:800;line-height:1.25;">See you tomorrow!</h1>
        <p class="ms-ink2" style="margin:0 0 20px;color:${C.ink2};font-size:15px;">Your booking is coming up — arrive a few minutes early.</p>
        ${badge('Reminder', th.badgeBg, th.badgeFg)}
        ${bookingCard(booking)}
        ${qrBlock(opts.qr || null)}
        <p class="ms-muted" style="margin:6px 0 0;color:${C.ink2};font-size:12px;">Your QR code stays valid; don't forward this email.</p>`,
      ctaText: 'View booking',
      ctaHref: `${appBase()}/bookings/${booking?.id || ''}`,
      plainText: text
    }),
    attachment: opts.qr
      ? { filename: 'booking-qr.png', content: null, contentType: 'image/png', inline: true, qrOpts: opts.qr }
      : null
  };
}

function buildBillHtml(booking, brand = DEFAULT_BRAND, opts = {}) {
  const th = themeFor(opts.tokens);
  const preheader = `Your bill for ${booking?.venue_name || 'your booking'} is ready.`;
  const base = Number(booking?.total_price || 0) - Number(booking?.tax_amount || 0) - Number(booking?.venue_tax_amount || 0);
  const invoiceNo = booking?.invoice_number ? `INV-${String(booking.invoice_number).padStart(4, '0')}` : '';
  const text = plainLines(
    `Your bill — ${booking?.venue_name || ''}`,
    `${booking?.court_name || ''}`,
    `When: ${fmtWhen(booking?.start_at)} — ${fmtWhen(booking?.end_at)}`,
    `Base: ${fmtLkr(base)}`,
    invoiceNo ? `Invoice No: ${invoiceNo}` : '',
    `Payment: ${booking?.payment_method === 'cash' ? 'Pay at venue' : 'Paid online'} — ${booking?.status || ''}`,
    '',
    'Your invoice PDF is attached.',
    '',
    footerLine(brand)
  );
  return {
    preheader,
    text,
    html: shell({
      brand,
      tokens: opts.tokens,
      preheader,
      content: `
        <h1 class="ms-ink" style="margin:0 0 8px;color:${C.ink};font-size:22px;font-weight:800;line-height:1.25;">Your bill is ready</h1>
        <p class="ms-ink2" style="margin:0 0 20px;color:${C.ink2};font-size:15px;">Thanks for playing — details below.</p>
        ${badge('Bill', th.badgeBg, th.badgeFg)}
        ${invoiceNo ? `<p class="ms-ink2" style="margin:0 0 6px;color:${C.ink2};font-size:13px;">Invoice No: <strong class="ms-ink" style="color:${C.ink};">${invoiceNo}</strong></p>` : ''}
        ${bookingCard(booking)}
        <p class="ms-muted" style="margin:6px 0 0;color:${C.ink2};font-size:12px;">Your invoice PDF is attached.</p>`,
      ctaText: 'View booking',
      ctaHref: `${appBase()}/bookings/${booking?.id || ''}`,
      plainText: text
    })
  };
}

function buildRegistrationBillHtml(reg, brand = DEFAULT_BRAND, opts = {}) {
  const th = themeFor(opts.tokens);
  const amount = Number(reg?.amount || 0);
  const preheader = `Your bill for ${reg?.event_name || 'your event'} is ready.`;
  const text = plainLines(
    `Your bill — ${reg?.event_name || ''}`,
    `When: ${fmtWhen(reg?.event_start)}`,
    `Total: ${fmtLkr(amount)}`,
    `Status: ${reg?.status || ''}`,
    '',
    'Your bill PDF is attached.',
    '',
    footerLine(brand)
  );
  return {
    preheader,
    text,
    html: shell({
      brand,
      tokens: opts.tokens,
      preheader,
      content: `
        <h1 class="ms-ink" style="margin:0 0 8px;color:${C.ink};font-size:22px;font-weight:800;line-height:1.25;">Your bill is ready</h1>
        <p class="ms-ink2" style="margin:0 0 20px;color:${C.ink2};font-size:15px;">Your event registration — summary below.</p>
        ${badge('Bill', th.badgeBg, th.badgeFg)}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="ms-card" style="border-collapse:collapse;background:${C.surface};border:1px solid ${C.border};border-radius:16px;">
          <tr><td style="padding:20px 24px;">
            <p class="ms-ink" style="margin:0 0 4px;color:${C.ink};font-size:17px;font-weight:800;">${escapeHtml(reg?.event_name || '')}</p>
            <p class="ms-muted" style="margin:0;color:${C.ink2};font-size:13px;">When: ${fmtWhen(reg?.event_start)}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:14px;">
              <tr><td style="padding:4px 0;"><span class="ms-muted" style="color:${C.ink2};font-size:13px;">Total</span></td><td align="right" style="color:${C.ink};font-size:14px;font-weight:700;">${fmtLkr(amount)}</td></tr>
              <tr><td style="padding:4px 0;"><span class="ms-muted" style="color:${C.ink2};font-size:13px;">Status</span></td><td align="right" style="color:${C.ink};font-size:14px;font-weight:700;">${escapeHtml(reg?.status || '')}</td></tr>
            </table>
          </td></tr>
        </table>`,
      ctaText: 'View event',
      ctaHref: `${appBase()}/events/${reg?.event_id || ''}`,
      plainText: text
    })
  };
}

function buildWelcomeHtml(brand = DEFAULT_BRAND, opts = {}) {
  const preheader = `Welcome to ${brand}. Book courts, join games, find players.`;
  const text = plainLines(
    `Welcome to ${brand}!`,
    'You\'re all set to book courts, join games, and discover sports near you.',
    'Find a venue, pick a slot, and your next match starts here.',
    '',
    footerLine(brand)
  );
  return {
    preheader,
    text,
    html: shell({
      brand,
      preheader,
      content: `
        <h1 class="ms-ink" style="margin:0 0 8px;color:${C.ink};font-size:22px;font-weight:800;line-height:1.25;">Welcome to ${escapeHtml(brand)}!</h1>
        <p class="ms-ink2" style="margin:0 0 20px;color:${C.ink2};font-size:15px;">You're all set to book courts, join games, and discover sports near you.</p>
        <p class="ms-muted" style="margin:0;color:${C.ink2};font-size:14px;">Find a venue, pick a slot, and your next match starts here.</p>`,
      ctaText: 'Start exploring',
      ctaHref: `${appBase()}`,
      plainText: text
    })
  };
}

// Verified-email OTP (ticket 01): the same code-in-SMS mental model, delivered
// by email so the Booking Widget's QR can always reach an inbox.
function buildVerificationCodeHtml(code, brand = DEFAULT_BRAND, ttlMinutes = 10) {
  const safeCode = escapeHtml(code);
  const preheader = `Your verification code is ${code}.`;
  const text = plainLines(
    `Your ${brand} verification code is ${code}.`,
    `It expires in ${ttlMinutes} minutes. Do not share it.`,
    '',
    footerLine(brand)
  );
  return {
    preheader,
    text,
    html: shell({
      brand,
      preheader,
      content: `
        <h1 class="ms-ink" style="margin:0 0 8px;color:${C.ink};font-size:22px;font-weight:800;line-height:1.25;">Verify your email</h1>
        <p class="ms-ink2" style="margin:0 0 20px;color:${C.ink2};font-size:15px;">Enter this code to confirm this inbox belongs to your ${escapeHtml(brand)} account.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="border-collapse:collapse;margin:8px auto 0;">
          <tr>
            <td style="background:${C.primaryLight};border-radius:16px;padding:16px 32px;text-align:center;">
              <span style="color:${C.primaryDark};font-family:'SF Mono',ui-monospace,Menlo,Consolas,monospace;font-size:28px;font-weight:800;letter-spacing:8px;">${safeCode}</span>
            </td>
          </tr>
        </table>
        <p class="ms-muted" style="margin:20px 0 0;color:${C.ink2};font-size:13px;">It expires in ${ttlMinutes} minutes. If you didn't request this, you can ignore this email.</p>`,
      plainText: text
    })
  };
}

function buildVenueApprovedHtml(venue, brand = DEFAULT_BRAND, opts = {}) {
  const preheader = `Good news — ${venue?.name || 'your venue'} is live.`;
  const text = plainLines(
    'Your venue is live!',
    `Good news — "${venue?.name || ''}" has been approved and is now visible to players.`,
    'Log in to manage your courts, pricing, and bookings.',
    '',
    footerLine(brand)
  );
  return {
    preheader,
    text,
    html: shell({
      brand,
      preheader,
      content: `
        <h1 class="ms-ink" style="margin:0 0 8px;color:${C.ink};font-size:22px;font-weight:800;line-height:1.25;">Your venue is live!</h1>
        <p class="ms-ink2" style="margin:0 0 20px;color:${C.ink2};font-size:15px;">Good news — <strong>"${escapeHtml(venue?.name || '')}"</strong> has been approved and is now visible to players.</p>
        <p class="ms-muted" style="margin:0;color:${C.ink2};font-size:14px;">Log in to manage your courts, pricing, and bookings.</p>`,
      ctaText: 'Open console',
      ctaHref: `${consoleBase()}`,
      plainText: text
    })
  };
}

function buildVenueRejectedHtml(venue, reason, brand = DEFAULT_BRAND, opts = {}) {
  const preheader = `Update on ${venue?.name || 'your venue'} — changes needed.`;
  const text = plainLines(
    'Update on your venue',
    `"${venue?.name || ''}" could not be approved this time.`,
    `Reason: ${reason || ''}`,
    'You can edit and resubmit the venue for review.',
    '',
    footerLine(brand)
  );
  return {
    preheader,
    text,
    html: shell({
      brand,
      preheader,
      content: `
        <h1 class="ms-ink" style="margin:0 0 8px;color:${C.error};font-size:22px;font-weight:800;line-height:1.25;">Update on your venue</h1>
        <p class="ms-ink2" style="margin:0 0 20px;color:${C.ink2};font-size:15px;"><strong>"${escapeHtml(venue?.name || '')}"</strong> could not be approved this time.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="ms-card" style="border-collapse:collapse;background:${C.errorLight};border:1px solid ${C.error};border-radius:12px;">
          <tr><td style="padding:14px 18px;color:${C.error};font-size:14px;font-weight:700;">Reason: ${escapeHtml(reason || '')}</td></tr>
        </table>
        <p class="ms-muted" style="margin:14px 0 0;color:${C.ink2};font-size:14px;">You can edit and resubmit the venue for review.</p>`,
      ctaText: 'Open console',
      ctaHref: `${consoleBase()}`,
      plainText: text
    })
  };
}

function taxLine(rate, tax, venueRate, venueTax) {
  const lines = [];
  lines.push(Number(rate || 0) > 0 ? `Platform tax: ${fmtLkr(tax || 0)}` : 'Platform tax: Not applicable');
  lines.push(Number(venueRate || 0) > 0 ? `Venue tax: ${fmtLkr(venueTax || 0)}` : 'Venue tax: Not applicable');
  return lines.join('<br>');
}

function buildPlayerCancelledHtml(booking, refund, brand = DEFAULT_BRAND, opts = {}) {
  const th = themeFor(opts.tokens);
  const refundAmount = Number(refund?.refund_amount || 0);
  const refundLine = refundAmount > 0
    ? `<p class="ms-ink" style="margin:14px 0 0;color:${C.ink};font-size:14px;"><strong>Refund:</strong> ${fmtLkr(refundAmount)} will be returned to your payment method.</p>`
    : '<p class="ms-muted" style="margin:14px 0 0;color:${C.ink2};font-size:13px;">No refund applies to this booking.</p>';
  const preheader = `Your booking at ${booking?.venue_name || ''} has been cancelled.`;
  const text = plainLines(
    'Booking cancelled',
    `${booking?.venue_name || ''} — ${booking?.court_name || ''}`,
    `When: ${fmtWhen(booking?.start_at)} — ${fmtWhen(booking?.end_at)}`,
    refundAmount > 0 ? `Refund: ${fmtLkr(refundAmount)} will be returned.` : 'No refund applies to this booking.',
    'If you did not cancel this booking, contact the venue.',
    '',
    footerLine(brand)
  );
  return {
    preheader,
    text,
    html: shell({
      brand,
      tokens: opts.tokens,
      preheader,
      content: `
        <h1 class="ms-ink" style="margin:0 0 8px;color:${C.ink};font-size:22px;font-weight:800;line-height:1.25;">Booking cancelled</h1>
        <p class="ms-ink2" style="margin:0 0 20px;color:${C.ink2};font-size:15px;">Your booking has been cancelled.</p>
        ${bookingCard(booking)}
        ${refundLine}
        <p class="ms-muted" style="margin:6px 0 0;color:${C.ink2};font-size:12px;">If you did not cancel this booking, contact the venue.</p>`,
      ctaText: 'Browse bookings',
      ctaHref: `${appBase()}/bookings`,
      plainText: text
    })
  };
}

function buildOwnerBookingCancelledHtml(booking, brand = DEFAULT_BRAND, opts = {}) {
  const th = themeFor(opts.tokens);
  const preheader = `A player cancelled a booking at ${booking?.venue_name || 'your venue'}.`;
  const text = plainLines(
    'Booking cancelled at your venue',
    `${booking?.venue_name || ''} — ${booking?.court_name || ''}`,
    `When: ${fmtWhen(booking?.start_at)} — ${fmtWhen(booking?.end_at)}`,
    booking?.player_name ? `Player: ${booking.player_name}` : '',
    'The slot is now free to rebook.',
    '',
    footerLine(brand)
  );
  return {
    preheader,
    text,
    html: shell({
      brand,
      tokens: opts.tokens,
      preheader,
      content: `
        <h1 class="ms-ink" style="margin:0 0 8px;color:${C.warning};font-size:22px;font-weight:800;line-height:1.25;">A booking was cancelled</h1>
        <p class="ms-ink2" style="margin:0 0 20px;color:${C.ink2};font-size:15px;">A booking at your venue has been cancelled by the player.</p>
        ${bookingCard(booking)}
        <p class="ms-muted" style="margin:6px 0 0;color:${C.ink2};font-size:12px;">The slot is now free to rebook.</p>`,
      ctaText: 'Open console',
      ctaHref: `${consoleBase()}`,
      plainText: text
    })
  };
}

function buildVenueCancelledHtml(booking, brand = DEFAULT_BRAND, opts = {}) {
  const th = themeFor(opts.tokens);
  const preheader = `Your booking at ${booking?.venue_name || ''} was cancelled by the venue.`;
  const text = plainLines(
    'Booking cancelled by the venue',
    `${booking?.venue_name || ''} — ${booking?.court_name || ''}`,
    `When: ${fmtWhen(booking?.start_at)} — ${fmtWhen(booking?.end_at)}`,
    'Please contact the venue if you have questions.',
    '',
    footerLine(brand)
  );
  return {
    preheader,
    text,
    html: shell({
      brand,
      tokens: opts.tokens,
      preheader,
      content: `
        <h1 class="ms-ink" style="margin:0 0 8px;color:${C.error};font-size:22px;font-weight:800;line-height:1.25;">Booking cancelled by the venue</h1>
        <p class="ms-ink2" style="margin:0 0 20px;color:${C.ink2};font-size:15px;">The venue cancelled your booking.</p>
        ${bookingCard(booking)}
        <p class="ms-muted" style="margin:6px 0 0;color:${C.ink2};font-size:12px;">Please contact the venue if you have questions.</p>`,
      ctaText: 'Browse bookings',
      ctaHref: `${appBase()}/bookings`,
      plainText: text
    })
  };
}

function buildEventRegisteredHtml(reg, brand = DEFAULT_BRAND, opts = {}) {
  const th = themeFor(opts.tokens);
  const preheader = `You're in for ${reg?.event_name || 'the event'} — see you there.`;
  const text = plainLines(
    `You're in — ${reg?.event_name || ''}`,
    `When: ${fmtWhen(reg?.event_start)}`,
    'Your registration is confirmed. See you there!',
    '',
    footerLine(brand)
  );
  return {
    preheader,
    text,
    html: shell({
      brand,
      tokens: opts.tokens,
      preheader,
      content: `
        <h1 class="ms-ink" style="margin:0 0 8px;color:${C.ink};font-size:22px;font-weight:800;line-height:1.25;">You're in!</h1>
        <p class="ms-ink2" style="margin:0 0 20px;color:${C.ink2};font-size:15px;">Your registration is confirmed.</p>
        ${badge('Registered', th.badgeBg, th.badgeFg)}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="ms-card" style="border-collapse:collapse;background:${C.surface};border:1px solid ${C.border};border-radius:16px;">
          <tr><td style="padding:20px 24px;">
            <p class="ms-ink" style="margin:0 0 4px;color:${C.ink};font-size:17px;font-weight:800;">${escapeHtml(reg?.event_name || '')}</p>
            <p class="ms-muted" style="margin:0;color:${C.ink2};font-size:13px;">When: ${fmtWhen(reg?.event_start)}${reg?.event_end ? ` — ${fmtWhen(reg.event_end)}` : ''}</p>
            ${reg?.venue_name ? `<p class="ms-muted" style="margin:0;color:${C.ink2};font-size:13px;">Venue: ${escapeHtml(reg.venue_name)}</p>` : ''}
          </td></tr>
        </table>`,
      ctaText: 'View event',
      ctaHref: `${appBase()}/events/${reg?.event_id || ''}`,
      plainText: text
    })
  };
}

function buildEventCancelledHtml(reg, brand = DEFAULT_BRAND, opts = {}) {
  const th = themeFor(opts.tokens);
  const preheader = `${reg?.event_name || 'The event'} has been cancelled.`;
  const text = plainLines(
    'Event cancelled',
    `${reg?.event_name || ''}`,
    `When: ${fmtWhen(reg?.event_start)}`,
    'Your payment will be refunded. Refunds are processed manually and may take a few days.',
    '',
    footerLine(brand)
  );
  return {
    preheader,
    text,
    html: shell({
      brand,
      tokens: opts.tokens,
      preheader,
      content: `
        <h1 class="ms-ink" style="margin:0 0 8px;color:${C.error};font-size:22px;font-weight:800;line-height:1.25;">Event cancelled</h1>
        <p class="ms-ink2" style="margin:0 0 20px;color:${C.ink2};font-size:15px;">The event you registered for has been cancelled.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="ms-card" style="border-collapse:collapse;background:${C.errorLight};border:1px solid ${C.error};border-radius:12px;">
          <tr><td style="padding:14px 18px;color:${C.error};font-size:14px;font-weight:700;">${escapeHtml(reg?.event_name || '')} — ${fmtWhen(reg?.event_start)}</td></tr>
        </table>
        <p class="ms-muted" style="margin:14px 0 0;color:${C.ink2};font-size:13px;">Your payment will be refunded. Refunds are processed manually and may take a few days.</p>`,
      ctaText: 'Browse events',
      ctaHref: `${appBase()}/events`,
      plainText: text
    })
  };
}

function buildEventCancelledOwnerHtml(event, brand = DEFAULT_BRAND, opts = {}) {
  const th = themeFor(opts.tokens);
  const preheader = `${event?.name || 'Your event'} has been cancelled.`;
  const text = plainLines(
    'Event cancelled',
    `${event?.name || ''}`,
    'Registrant payments are marked for manual refund.',
    '',
    footerLine(brand)
  );
  return {
    preheader,
    text,
    html: shell({
      brand,
      tokens: opts.tokens,
      preheader,
      content: `
        <h1 class="ms-ink" style="margin:0 0 8px;color:${C.error};font-size:22px;font-weight:800;line-height:1.25;">Event cancelled</h1>
        <p class="ms-ink2" style="margin:0 0 20px;color:${C.ink2};font-size:15px;">Your event has been cancelled and all registrants have been notified.</p>
        <p class="ms-muted" style="margin:0;color:${C.ink2};font-size:13px;">Registrant payments are marked for manual refund.</p>`,
      ctaText: 'Open console',
      ctaHref: `${consoleBase()}`,
      plainText: text
    })
  };
}

function bankDetailsHtml(details) {
  const d = details || {};
  const parts = [
    d.bank ? `Bank: ${escapeHtml(d.bank)}` : null,
    d.account_name ? `Account name: ${escapeHtml(d.account_name)}` : null,
    d.account_number ? `Account number: ${escapeHtml(d.account_number)}` : null,
    d.branch ? `Branch: ${escapeHtml(d.branch)}` : null
  ].filter(Boolean);
  return parts.length ? `<p class="ms-muted" style="margin:14px 0 0;color:${C.ink2};font-size:13px;">Payments: ${parts.join(' • ')}</p>` : '';
}

function buildOwnerWelcomeHtml(owner, temporaryPassword, plan, bankDetails, brand = DEFAULT_BRAND, opts = {}) {
  const planLine = plan ? `${escapeHtml(plan.name)} — ${plan.price_lkr > 0 ? `LKR ${plan.price_lkr}` : 'Free'} (${plan.start_date} to ${plan.end_date})` : 'No plan attached';
  const preheader = `Your ${brand} venue-owner account is ready.`;
  const text = plainLines(
    'Your venue-owner account is ready',
    `Sign-in email: ${owner?.email || ''}`,
    `Temporary password: ${temporaryPassword || ''}`,
    'You will be asked to change this password on your first sign-in.',
    `Plan: ${plan?.name || 'No plan attached'}`,
    'The Owner Agreement is attached — please review and accept it.',
    '',
    footerLine(brand)
  );
  return {
    preheader,
    text,
    html: shell({
      brand,
      preheader,
      content: `
        <h1 class="ms-ink" style="margin:0 0 8px;color:${C.ink};font-size:22px;font-weight:800;line-height:1.25;">Your venue-owner account is ready</h1>
        <p class="ms-ink2" style="margin:0 0 20px;color:${C.ink2};font-size:15px;">Hi ${escapeHtml(owner?.name || '')}, your ${escapeHtml(brand)} venue-owner account has been created.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="ms-card" style="border-collapse:collapse;background:${C.surface};border:1px solid ${C.border};border-radius:16px;">
          <tr><td style="padding:20px 24px;">
            <p class="ms-ink" style="margin:0 0 4px;color:${C.ink};font-size:14px;"><strong>Sign-in email:</strong> ${escapeHtml(owner?.email || '')}</p>
            <p class="ms-ink" style="margin:0 0 4px;color:${C.ink};font-size:14px;"><strong>Temporary password:</strong> ${escapeHtml(temporaryPassword || '')}</p>
            <p class="ms-muted" style="margin:0;color:${C.ink2};font-size:12px;">You will be asked to change this password on your first sign-in.</p>
          </td></tr>
        </table>
        <p class="ms-ink" style="margin:14px 0 0;color:${C.ink};font-size:14px;"><strong>Plan:</strong> ${planLine}</p>
        <p class="ms-muted" style="margin:14px 0 0;color:${C.ink2};font-size:13px;">The Owner Agreement is attached to this email and is also waiting for you in the console — please review it and accept before you start managing venues.</p>
        ${bankDetailsHtml(bankDetails)}`,
      ctaText: 'Open console',
      ctaHref: `${consoleBase()}`,
      plainText: text
    })
  };
}

function buildOwnerRenewalHtml(owner, plan, bankDetails, brand = DEFAULT_BRAND, opts = {}) {
  const preheader = `Your ${brand} plan has been renewed.`;
  const text = plainLines(
    'Your plan has been renewed',
    `Plan: ${plan?.name || ''}`,
    'A new Owner Agreement is attached and waiting for your acceptance.',
    '',
    footerLine(brand)
  );
  return {
    preheader,
    text,
    html: shell({
      brand,
      preheader,
      content: `
        <h1 class="ms-ink" style="margin:0 0 8px;color:${C.ink};font-size:22px;font-weight:800;line-height:1.25;">Your plan has been renewed</h1>
        <p class="ms-ink2" style="margin:0 0 20px;color:${C.ink2};font-size:15px;">Hi ${escapeHtml(owner?.name || '')}, a new plan term has been set up for your account.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="ms-card" style="border-collapse:collapse;background:${C.surface};border:1px solid ${C.border};border-radius:16px;">
          <tr><td style="padding:20px 24px;">
            <p class="ms-ink" style="margin:0;color:${C.ink};font-size:14px;"><strong>Plan:</strong> ${escapeHtml(plan?.name || '')} — ${plan && plan.price_lkr > 0 ? `LKR ${plan.price_lkr}` : 'Free'} (${plan?.start_date || ''} to ${plan?.end_date || ''})</p>
          </td></tr>
        </table>
        <p class="ms-muted" style="margin:14px 0 0;color:${C.ink2};font-size:13px;">A new Owner Agreement is attached and waiting for your acceptance in the console.</p>
        ${bankDetailsHtml(bankDetails)}
        <p class="ms-muted" style="margin:6px 0 0;color:${C.ink2};font-size:13px;">Renewal payment is handled off-platform — see the payment details above.</p>`,
      ctaText: 'Open console',
      ctaHref: `${consoleBase()}`,
      plainText: text
    })
  };
}

function buildOwnerNudgeHtml(owner, plan, bankDetails, brand = DEFAULT_BRAND, opts = {}) {
  const daysLeft = plan && plan.end_date
    ? Math.max(0, Math.ceil((new Date(`${plan.end_date}T23:59:59+05:30`) - new Date()) / (24 * 3600 * 1000)))
    : null;
  const preheader = `Your ${brand} plan is ending soon.`;
  const text = plainLines(
    'Your plan is ending soon',
    plan ? `Plan: ${plan.name}${daysLeft !== null ? ` (ends ${plan.end_date}, ${daysLeft} day${daysLeft === 1 ? '' : 's'})` : ' is ending'}` : 'Your plan is ending',
    'Reach out to the platform team to renew.',
    'Your venue stays live while you sort out the renewal.',
    '',
    footerLine(brand)
  );
  return {
    preheader,
    text,
    html: shell({
      brand,
      preheader,
      content: `
        <h1 class="ms-ink" style="margin:0 0 8px;color:${C.warning};font-size:22px;font-weight:800;line-height:1.25;">Your plan is ending soon</h1>
        <p class="ms-ink2" style="margin:0 0 20px;color:${C.ink2};font-size:15px;">Hi ${escapeHtml(owner?.name || '')}, your current plan${plan ? ` (${escapeHtml(plan.name)})` : ''}${daysLeft !== null ? ` ends on ${escapeHtml(plan.end_date)} (${daysLeft} day${daysLeft === 1 ? '' : 's'}).` : ' is ending.'} Reach out to the platform team to renew.</p>
        ${bankDetailsHtml(bankDetails)}
        <p class="ms-muted" style="margin:6px 0 0;color:${C.ink2};font-size:13px;">Your venue stays live while you sort out the renewal.</p>`,
      ctaText: 'Open console',
      ctaHref: `${consoleBase()}`,
      plainText: text
    })
  };
}

module.exports = {
  C,
  DEFAULT_BRAND,
  escapeHtml,
  brandWordmark,
  brandHeader,
  themeFor,
  shell,
  qrPng,
  badge,
  venueRow,
  qrBlock,
  bookingCard,
  buildBookingHtml,
  buildOwnerBookingHtml,
  buildPendingBookingHtml,
  buildReminderHtml,
  buildWelcomeHtml,
  buildVerificationCodeHtml,
  buildVenueApprovedHtml,
  buildVenueRejectedHtml,
  buildBillHtml,
  buildRegistrationBillHtml,
  buildPlayerCancelledHtml,
  buildOwnerBookingCancelledHtml,
  buildVenueCancelledHtml,
  buildEventRegisteredHtml,
  buildEventCancelledHtml,
  buildEventCancelledOwnerHtml,
  buildOwnerWelcomeHtml,
  buildOwnerRenewalHtml,
  buildOwnerNudgeHtml
};