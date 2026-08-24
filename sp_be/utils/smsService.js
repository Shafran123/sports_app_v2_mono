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

function buildBookingSms(booking, brand = DEFAULT_BRAND) {
  const method = booking.payment_method === 'cash' ? 'Pay at venue' : 'Paid online';
  return `${brand}: Booking confirmed at ${booking.venue_name || ''} (${booking.court_name || ''}) on ${fmtWhen(booking.start_at)}. ${method}. Show the QR at check-in.`;
}

function buildOwnerBookingSms(booking, brand = DEFAULT_BRAND) {
  const method = booking.payment_method === 'cash' ? 'Pay at venue' : 'Paid online';
  return `${brand}: New booking at your venue ${booking.venue_name || ''} (${booking.court_name || ''}) on ${fmtWhen(booking.start_at)}. ${method}.`;
}

function buildReminderSms(booking, brand = DEFAULT_BRAND) {
  return `${brand}: Reminder — your booking at ${booking.venue_name || ''} (${booking.court_name || ''}) is on ${fmtWhen(booking.start_at)}. Have your QR ready.`;
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

function buildWalkinSms(booking, brand = DEFAULT_BRAND) {
  return `${brand}: Booking confirmed at ${booking.venue_name || ''} (${booking.court_name || ''}) on ${fmtWhen(booking.start_at)}. Show the QR at check-in.`;
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
      body: JSON.stringify({ to, message, mask: process.env.SMSGO_MASK || DEFAULT_MASK })
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error(`SMSGo send error ${res.status}: ${text}`);
      return { success: false, error: `SMSGo ${res.status}` };
    }

    logger.info(`SMS sent successfully to ${to}`);
    return { success: true, id: null };
  } catch (err) {
    logger.error(`SMS exception: ${err.message}`);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendSms,
  formatSriLankanPhone,
  buildBookingSms,
  buildOwnerBookingSms,
  buildReminderSms,
  buildPlayerCancelledSms,
  buildOwnerBookingCancelledSms,
  buildVenueCancelledSms,
  buildWalkinSms,
  buildEventRegisteredSms,
  buildEventCancelledSms
};