const logger = require('./logger');
const { fmtWhen, fmtLkr } = require('./format');

const DEFAULT_FROM = process.env.FROM_EMAIL || 'Spots <no-reply@spots.lk>';

// Escape any user-sourced string before it lands in an HTML email template.
// Venue names, player names, and rejection reasons are free text — unescaped,
// a name like `<img src=x onerror=...>` executes in the recipient's mail client.
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isConfigured() {
  return Boolean(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN);
}

/**
 * Send a transactional email via Mailgun. Fire-and-forget: never throws and
 * never blocks the caller. Without credentials it logs and skips.
 * Optional single attachment ({ filename, content: Buffer, contentType })
 * switches the body to multipart/form-data for Mailgun.
 */
async function sendEmail({ to, subject, html, attachment }) {
  if (!isConfigured()) {
    logger.warn('Mailgun not configured (MAILGUN_API_KEY / MAILGUN_DOMAIN) - skipping email');
    return { success: false, error: 'Email not configured' };
  }

  try {
    const endpoint = `https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`;
    const headers = {
      Authorization: `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`
    };

    let body;
    if (attachment) {
      const form = new FormData();
      form.append('from', process.env.FROM_EMAIL || DEFAULT_FROM);
      form.append('to', Array.isArray(to) ? to.join(',') : to);
      form.append('subject', subject);
      form.append('html', html);
      form.append(
        'attachment',
        new Blob([attachment.content], { type: attachment.contentType || 'application/octet-stream' }),
        attachment.filename || 'attachment'
      );
      body = form;
    } else {
      const form = new URLSearchParams();
      form.append('from', process.env.FROM_EMAIL || DEFAULT_FROM);
      form.append('to', Array.isArray(to) ? to.join(',') : to);
      form.append('subject', subject);
      form.append('html', html);
      body = form;
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    const res = await fetch(endpoint, { method: 'POST', headers, body });

    if (!res.ok) {
      const text = await res.text();
      logger.error(`Mailgun send error ${res.status}: ${text}`);
      return { success: false, error: `Mailgun ${res.status}` };
    }

    logger.info(`Email sent successfully: ${Array.isArray(to) ? to.join(',') : to}`);
    return { success: true, id: null };
  } catch (err) {
    logger.error(`Email exception: ${err.message}`);
    return { success: false, error: err.message };
  }
}

function shell(start) {
  return `<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f7f7f8;"><div style="background:#fff;padding:32px;border-radius:16px;margin:16px auto;">${start}<hr style="border:none;border-top:1px solid #eee;margin:24px 0;"><p style="color:#999;font-size:12px;text-align:center;">Spots — book courts, join games, find players.</p></div></body></html>`;
}

function buildBookingHtml(booking) {
  const venueName = escapeHtml(booking.venue_name || '');
  const courtName = escapeHtml(booking.court_name || '');
  return shell(`
    <h2 style="color:#176036;">Booking confirmed — ${venueName}</h2>
    <p>Your slot is booked. Show the QR code at the venue to check in.</p>
    <div style="background:#f0fdf4;padding:16px;border-radius:12px;border:1px solid #22c55e;">
      <p><strong>${venueName || 'Venue'}</strong> — ${courtName}</p>
      <p><strong>Time:</strong> ${fmtWhen(booking.start_at)} — ${fmtWhen(booking.end_at)}</p>
      <p><strong>Total:</strong> ${fmtLkr(booking.total_price)}</p>
      <p><strong>Payment:</strong> ${booking.payment_method === 'cash' ? 'Pay at venue' : 'Paid online'}</p>
    </div>
    <p style="color:#666;">Find your QR code under Bookings in the Spots app and show it on arrival.</p>`);
}

function buildReminderHtml(booking) {
  const venueName = escapeHtml(booking.venue_name || '');
  const courtName = escapeHtml(booking.court_name || '');
  return shell(`
    <h2 style="color:#176036;">Reminder — ${venueName || 'your booking'}</h2>
    <p>This is a reminder that your booking is coming up.</p>
    <div style="background:#f0fdf4;padding:16px;border-radius:12px;border:1px solid #22c55e;">
      <p><strong>${venueName || 'Venue'}</strong> — ${courtName}</p>
      <p><strong>Time:</strong> ${fmtWhen(booking.start_at)} — ${fmtWhen(booking.end_at)}</p>
    </div>
    <p style="color:#666;">Please arrive a few minutes early. Have your QR code ready to check in.</p>`);
}

function buildWelcomeHtml() {
  return shell(`
    <h2 style="color:#176036;">Welcome to Spots!</h2>
    <p>You're all set to book courts, join games, and discover sports near you.</p>
    <p style="color:#666;">Find a venue, pick a slot, and your next match starts here.</p>`);
}

function buildVenueApprovedHtml(venue) {
  const venueName = escapeHtml(venue.name || '');
  return shell(`
    <h2 style="color:#176036;">Your venue is live!</h2>
    <p>Good news — <strong>"${venueName}"</strong> has been approved and is now visible to players.</p>
    <p>Log in to manage your courts, pricing, and bookings.</p>`);
}

function buildVenueRejectedHtml(venue, reason) {
  const venueName = escapeHtml(venue.name || '');
  const safeReason = escapeHtml(reason || '');
  return shell(`
    <h2 style="color:#b91c1c;">Update on your venue "${venueName}"</h2>
    <p><strong>"${venueName}"</strong> could not be approved this time.</p>
    <p><strong>Reason:</strong> ${safeReason}</p>
    <p>You can edit and resubmit the venue for review.</p>`);
}

async function notifyBookingConfirmed(booking, userEmail) {
  return sendEmail({ to: userEmail, subject: `Booking confirmed — ${booking.venue_name || 'your slot'}`, html: buildBookingHtml(booking) });
}

function buildBillHtml(booking) {
  const venueName = escapeHtml(booking.venue_name || '');
  const courtName = escapeHtml(booking.court_name || '');
  const line = Number(booking.tax_rate || 0) > 0 ? `Tax: ${fmtLkr(booking.tax_amount || 0)}` : 'Tax: Not applicable';
  return shell(`
    <h2 style="color:#176036;">Your bill — ${venueName}</h2>
    <div style="background:#f0fdf4;padding:16px;border-radius:12px;border:1px solid #22c55e;">
      <p><strong>${venueName || 'Venue'}</strong> — ${courtName}</p>
      <p><strong>Time:</strong> ${fmtWhen(booking.start_at)} — ${fmtWhen(booking.end_at)}</p>
      <p><strong>Base:</strong> ${fmtLkr(Number(booking.total_price || 0) - Number(booking.tax_amount || 0))}</p>
      <p><strong>${line}</strong></p>
      <p><strong>Total:</strong> ${fmtLkr(booking.total_price)}</p>
      <p><strong>Payment:</strong> ${booking.payment_method === 'cash' ? 'Pay at venue' : 'Paid online'} — ${escapeHtml(booking.status || '')}</p>
    </div>
    <p style="color:#666;">Your bill PDF is attached — it also carries the QR code for check-in.</p>`);
}

function buildRegistrationBillHtml(reg) {
  const eventName = escapeHtml(reg.event_name || '');
  const line = Number(reg.tax_rate || 0) > 0 ? `Tax: ${fmtLkr(reg.tax_amount || 0)}` : 'Tax: Not applicable';
  const amount = Number(reg.amount || 0);
  return shell(`
    <h2 style="color:#176036;">Your bill — ${eventName}</h2>
    <div style="background:#f0fdf4;padding:16px;border-radius:12px;border:1px solid #22c55e;">
      <p><strong>Event:</strong> ${eventName}</p>
      <p><strong>When:</strong> ${fmtWhen(reg.event_start)}</p>
      <p><strong>Base:</strong> ${fmtLkr(amount - Number(reg.tax_amount || 0))}</p>
      <p><strong>${line}</strong></p>
      <p><strong>Total:</strong> ${fmtLkr(amount)}</p>
      <p><strong>Status:</strong> ${escapeHtml(reg.status || '')}</p>
    </div>
    <p style="color:#666;">Your bill PDF is attached.</p>`);
}

async function notifyBookingReminder(booking, userEmail) {
  return sendEmail({ to: userEmail, subject: `Reminder — ${booking.venue_name || 'your booking'} tomorrow`, html: buildReminderHtml(booking) });
}

async function notifySignupWelcome(userEmail, name) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi,';
  const html = buildWelcomeHtml().replace('<p>You\'re all set.', `<p>${greeting} You're all set.`);
  return sendEmail({ to: userEmail, subject: 'Welcome to Spots', html });
}

async function notifyVenueApproved(venue, ownerEmail) {
  return sendEmail({ to: ownerEmail, subject: `Your venue "${venue.name}" is live!`, html: buildVenueApprovedHtml(venue) });
}

async function notifyVenueRejected(venue, ownerEmail, reason) {
  return sendEmail({ to: ownerEmail, subject: `Update on your venue "${venue.name}"`, html: buildVenueRejectedHtml(venue, reason) });
}

module.exports = {
  sendEmail,
  notifyBookingConfirmed,
  notifyBookingReminder,
  notifySignupWelcome,
  notifyVenueApproved,
  notifyVenueRejected,
  escapeHtml,
  buildBookingHtml,
  buildBillHtml,
  buildRegistrationBillHtml,
  shell
};