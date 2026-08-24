const logger = require('./logger');
const emailTemplates = require('./emailTemplates');

const DEFAULT_FROM = process.env.FROM_EMAIL || 'MySlot.LK <no-reply@myslot.lk>';

function isConfigured() {
  return Boolean(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN);
}

/**
 * Send a transactional email via Mailgun. Fire-and-forget: never throws and
 * never blocks the caller. Without credentials it logs and skips.
 *
 * attachments: array of { filename, content: Buffer, contentType, inline }.
 * `inline: true` parts are sent as Mailgun `inline` (referenced by cid:filename
 * from the HTML) instead of regular attachments.
 */
async function sendEmail({ to, subject, html, text, attachment, attachments }) {
  if (!isConfigured()) {
    logger.warn('Mailgun not configured (MAILGUN_API_KEY / MAILGUN_DOMAIN) - skipping email');
    return { success: false, error: 'Email not configured' };
  }

  try {
    const endpoint = `https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`;
    const headers = {
      Authorization: `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`
    };

    const allAttachments = [...(attachments || []), ...(attachment ? [attachment] : [])].filter(Boolean);

    let body;
    if (allAttachments.length > 0) {
      const form = new FormData();
      form.append('from', process.env.FROM_EMAIL || DEFAULT_FROM);
      form.append('to', Array.isArray(to) ? to.join(',') : to);
      form.append('subject', subject);
      form.append('html', html);
      if (text) form.append('text', text);
      for (const a of allAttachments) {
        const blob = new Blob([a.content], { type: a.contentType || 'application/octet-stream' });
        form.append(a.inline ? 'inline' : 'attachment', blob, a.filename || 'attachment');
      }
      body = form;
    } else {
      const form = new URLSearchParams();
      form.append('from', process.env.FROM_EMAIL || DEFAULT_FROM);
      form.append('to', Array.isArray(to) ? to.join(',') : to);
      form.append('subject', subject);
      form.append('html', html);
      if (text) form.append('text', text);
      body = form;
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    const res = await fetch(endpoint, { method: 'POST', headers, body });

    if (!res.ok) {
      const textBody = await res.text();
      logger.error(`Mailgun send error ${res.status}: ${textBody}`);
      return { success: false, error: `Mailgun ${res.status}` };
    }

    logger.info(`Email sent successfully: ${Array.isArray(to) ? to.join(',') : to}`);
    return { success: true, id: null };
  } catch (err) {
    logger.error(`Email exception: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// Re-exports from the pure templates module so existing importers
// (notificationCatalog, dailyDigest, tests) keep working unchanged.
// `shell` keeps the legacy string signature: shell(content, brand).
module.exports = {
  sendEmail,
  escapeHtml: emailTemplates.escapeHtml,
  shell: (content, brand) => (typeof content === 'string'
    ? emailTemplates.shell({ brand, content })
    : emailTemplates.shell(content)),
  brandWordmark: emailTemplates.brandWordmark,
  qrPng: emailTemplates.qrPng,
  buildBookingHtml: emailTemplates.buildBookingHtml,
  buildOwnerBookingHtml: emailTemplates.buildOwnerBookingHtml,
  buildReminderHtml: emailTemplates.buildReminderHtml,
  buildWelcomeHtml: emailTemplates.buildWelcomeHtml,
  buildVenueApprovedHtml: emailTemplates.buildVenueApprovedHtml,
  buildVenueRejectedHtml: emailTemplates.buildVenueRejectedHtml,
  buildBillHtml: emailTemplates.buildBillHtml,
  buildRegistrationBillHtml: emailTemplates.buildRegistrationBillHtml,
  buildPlayerCancelledHtml: emailTemplates.buildPlayerCancelledHtml,
  buildOwnerBookingCancelledHtml: emailTemplates.buildOwnerBookingCancelledHtml,
  buildVenueCancelledHtml: emailTemplates.buildVenueCancelledHtml,
  buildEventRegisteredHtml: emailTemplates.buildEventRegisteredHtml,
  buildEventCancelledHtml: emailTemplates.buildEventCancelledHtml,
  buildEventCancelledOwnerHtml: emailTemplates.buildEventCancelledOwnerHtml,
  buildOwnerWelcomeHtml: emailTemplates.buildOwnerWelcomeHtml,
  buildOwnerRenewalHtml: emailTemplates.buildOwnerRenewalHtml,
  buildOwnerNudgeHtml: emailTemplates.buildOwnerNudgeHtml
};