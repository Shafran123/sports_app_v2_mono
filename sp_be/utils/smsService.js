const logger = require('./logger');
const { fmtWhen } = require('./format');
const { getFlag } = require('./featureFlags');

const SMSGO_URL = process.env.SMSGO_URL || 'https://api.smsgo.lk/api/v1/sms/send';
const DEFAULT_MASK = process.env.SMSGO_MASK || 'SPOTS';

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

function buildBookingSms(booking) {
  const method = booking.payment_method === 'cash' ? 'Pay at venue' : 'Paid online';
  return `Spots: Booking confirmed at ${booking.venue_name || ''} (${booking.court_name || ''}) on ${fmtWhen(booking.start_at)}. ${method}. Show the QR at check-in.`;
}

function buildCancellationSms(booking) {
  return `Spots: Your booking at ${booking.venue_name || ''} (${booking.court_name || ''}) on ${fmtWhen(booking.start_at)} was cancelled by the venue.`;
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

async function notifyBookingConfirmed(booking, phone) {
  return sendSms({ to: formatSriLankanPhone(phone), message: buildBookingSms(booking) });
}

async function notifyCancelledByAdmin(booking, phone) {
  return sendSms({ to: formatSriLankanPhone(phone), message: buildCancellationSms(booking) });
}

module.exports = {
  sendSms,
  formatSriLankanPhone,
  buildBookingSms,
  buildCancellationSms,
  notifyBookingConfirmed,
  notifyCancelledByAdmin
};