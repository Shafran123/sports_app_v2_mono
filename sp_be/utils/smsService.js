const logger = require('./logger');
const { fmtWhen } = require('./format');
const { getFlag } = require('./featureFlags');

const SMSGO_URL = process.env.SMSGO_URL || 'https://api.smsgo.lk/api/v1/sms/send';
const DEFAULT_MASK = process.env.SMSGO_MASK || 'MYSLOT';
const DEFAULT_BRAND = 'MySlot.LK';

function isConfigured() {
  return Boolean(process.env.SMSGO_API_KEY);
}

// Normalise a Sri Lankan mobile number to E.164, e.g. "077 123 4567" -> "+94771234567".
function formatSriLankanPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('94')) return `+${digits}`;
  if (digits.startsWith('0')) return `+94${digits.slice(1)}`;
  return `+94${digits}`;
}

// The QR check-in link disclosed to a booking's own player by SMS. The URL
// embeds the secret QR token, so it is only sent to the player recipient
// (never the owner/admin) — the same bearer model as the player's inline email
// QR. A widget player has no app and no email, so this is their only QR.
function bookingQrUrl(bookingId, qrToken) {
  const base = process.env.FRONTEND_URL;
  if (!base || !bookingId || !qrToken) return '';
  return `${base}/api/v1/public/qr/${bookingId}?t=${qrToken}`;
}

// The tokenized bill download link (ADR-0041) sent to a walk-in's phone at
// quick-book — the walk-in has no inbox and no app, so this is how their bill
// reaches them. Same bearer model as the QR link: the secret token is the
// disclosure.
function bookingBillUrl(bookingId, qrToken) {
  const base = process.env.FRONTEND_URL;
  if (!base || !bookingId || !qrToken) return '';
  return `${base}/api/v1/public/bill/${bookingId}?t=${qrToken}`;
}

function buildBookingSms(booking, brand = DEFAULT_BRAND, opts = {}) {
  const method = booking.payment_method === 'cash' ? 'Pay at venue' : 'Paid online';
  const qr = opts?.qrUrl ? ` Show your QR to check in: ${opts.qrUrl}` : ` Show the QR at check-in.`;
  return `${brand}: Booking confirmed at ${booking.venue_name || ''} (${booking.court_name || ''}) on ${fmtWhen(booking.start_at)}. ${method}.${qr}`;
}

function buildOwnerBookingSms(booking, brand = DEFAULT_BRAND) {
  const method = booking.payment_method === 'cash' ? 'Pay at venue' : 'Paid online';
  return `${brand}: New booking at your venue ${booking.venue_name || ''} (${booking.court_name || ''}) on ${fmtWhen(booking.start_at)}. ${method}.`;
}

// Awaiting-confirmation SMS (ADR-0040): no QR — the booking isn't confirmed yet.
function buildPendingBookingSms(booking, brand = DEFAULT_BRAND) {
  const method = booking.payment_method === 'cash' ? 'Pay at venue' : 'Paid online';
  return `${brand}: Booking request received at ${booking.venue_name || ''} (${booking.court_name || ''}) on ${fmtWhen(booking.start_at)} — awaiting the venue's confirmation. ${method}.`;
}

function buildOwnerPendingBookingSms(booking, brand = DEFAULT_BRAND) {
  const method = booking.payment_method === 'cash' ? 'Pay at venue' : 'Paid online';
  return `${brand}: Booking request at your venue ${booking.venue_name || ''} (${booking.court_name || ''}) on ${fmtWhen(booking.start_at)} — confirm it in your console. ${method}.`;
}

function buildReminderSms(booking, brand = DEFAULT_BRAND, opts = {}) {
  const qr = opts?.qrUrl ? ` Have your QR ready to check in: ${opts.qrUrl}` : ' Have your QR ready.';
  return `${brand}: Reminder — your booking at ${booking.venue_name || ''} (${booking.court_name || ''}) is on ${fmtWhen(booking.start_at)}.${qr}`;
}

function buildPlayerCancelledSms(booking, brand = DEFAULT_BRAND) {
  return `${brand}: Your booking at ${booking.venue_name || ''} (${booking.court_name || ''}) on ${fmtWhen(booking.start_at)} was cancelled.`;
}

function buildOwnerBookingCancelledSms(booking, brand = DEFAULT_BRAND) {
  return `${brand}: A booking at your venue ${booking.venue_name || ''} (${booking.court_name || ''}) on ${fmtWhen(booking.start_at)} was cancelled by the player.`;
}

function buildVenueCancelledSms(booking, brand = DEFAULT_BRAND) {
  return `${brand}: Your booking at ${booking.venue_name || ''} (${booking.court_name || ''}) on ${fmtWhen(booking.start_at)} was cancelled by the venue.`;
}

function buildWalkinSms(booking, brand = DEFAULT_BRAND, opts = {}) {
  const bill = opts?.billUrl ? ` View or download your bill: ${opts.billUrl}` : '';
  return `${brand}: Booking confirmed at ${booking.venue_name || ''} (${booking.court_name || ''}) on ${fmtWhen(booking.start_at)}. Pay at the venue.${bill}`;
}

function buildEventRegisteredSms(reg, brand = DEFAULT_BRAND) {
  return `${brand}: You're in for ${reg.event_name || ''} on ${fmtWhen(reg.event_start)}. See you there!`;
}

function buildEventCancelledSms(reg, brand = DEFAULT_BRAND) {
  return `${brand}: The event ${reg.event_name || ''} on ${fmtWhen(reg.event_start)} has been cancelled.`;
}

/**
 * Send a transactional SMS via SMSGo.lk. Fire-and-forget: never throws and
 * never blocks the caller. Without credentials it logs and skips.
 */
async function sendSms({ to, message }) {
  if (!(await getFlag('sms_enabled'))) {
    logger.warn('SMS disabled by feature flag (sms_enabled) - skipping SMS');
    return { success: false, error: 'SMS disabled' };
  }
  if (!isConfigured()) {
    logger.warn('SMSGo API key not configured (SMSGO_API_KEY) - skipping SMS');
    return { success: false, error: 'SMS not configured' };
  }

  try {
    const res = await fetch(SMSGO_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.SMSGO_API_KEY
      },
      // SMSGo expects a bare national number ("9477…") — strip the E.164 "+".
      body: JSON.stringify({ to: String(to).replace(/^\+/, ''), message, mask: process.env.SMSGO_MASK || DEFAULT_MASK })
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error(`SMSGo send error ${res.status}: ${text}`);
      return { success: false, error: `SMSGo ${res.status}` };
    }

    // SMSGo returns { success: true, data: { id: "msg_…" } } — surface the id so
    // the notification catalog can record it as the provider ref.
    let providerId = null;
    try {
      const payload = await res.json();
      providerId = payload?.data?.id || null;
    } catch {
      providerId = null;
    }

    logger.info(`SMS sent successfully to ${to}`);
    return { success: true, id: providerId };
  } catch (err) {
    logger.error(`SMS exception: ${err.message}`);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendSms,
  formatSriLankanPhone,
  bookingQrUrl,
  bookingBillUrl,
  buildBookingSms,
  buildOwnerBookingSms,
  buildPendingBookingSms,
  buildOwnerPendingBookingSms,
  buildReminderSms,
  buildPlayerCancelledSms,
  buildOwnerBookingCancelledSms,
  buildVenueCancelledSms,
  buildWalkinSms,
  buildEventRegisteredSms,
  buildEventCancelledSms
};