const pool = require('../db');
const logger = require('./logger');
const emailService = require('./emailService');
const emailTemplates = require('./emailTemplates');
const smsService = require('./smsService');
const { getBrandName, getSmsEvents } = require('./featureFlags');
const { loadBookingForEvents, loadQrToken } = require('./bookingLoader');

// Booking-key emails that carry the player's inline check-in QR. QR is never
// rendered on owner/admin roles (guarded in the email loop + confirmed here).
const QR_KEYS = new Set(['booking.confirmed', 'booking.reminder', 'booking.bill']);

// First token of the booking's player name for subject personalization.
function firstNameOf(booking) {
  return String(booking?.player_name || '').trim().split(/\s+/)[0] || '';
}

// ---- Event / registration loaders (notification-specific shapes) ----

const EVENT_REGISTRATION_SELECT = `
  select r.id, r.user_id, r.status, e.id as event_id, e.name as event_name,
         e.start_at as event_start, e.end_at as event_end, e.city as event_city,
         v.name as venue_name,
         u.email as player_email, u.phone as player_phone, u.name as player_name
  from event_registrations r
  join events e on e.id = r.event_id
  left join venues v on v.id = e.venue_id
  join users u on u.id = r.user_id
  where r.id = $1`;

const EVENT_SELECT = `
  select e.*, v.name as venue_name,
         u.id as organizer_id, u.email as organizer_email, u.phone as organizer_phone
  from events e
  left join venues v on v.id = e.venue_id
  join users u on u.id = e.organizer_id
  where e.id = $1`;

const REGISTRANTS_SELECT = `
  select r.user_id, u.email, u.phone, u.name
  from event_registrations r
  join users u on u.id = r.user_id
  where r.event_id = $1 and r.status in ('pending', 'paid')`;

async function loadEventRegistration(registrationId) {
  const { rows } = await pool.query(EVENT_REGISTRATION_SELECT, [registrationId]);
  return rows[0] || null;
}

async function loadEvent(eventId) {
  const { rows } = await pool.query(EVENT_SELECT, [eventId]);
  return rows[0] || null;
}

async function loadEventRegistrants(eventId) {
  const { rows } = await pool.query(REGISTRANTS_SELECT, [eventId]);
  return rows.map((r) => ({ userId: r.user_id, email: r.email, phone: r.phone, name: r.name }));
}

async function loadAdmins() {
  const { rows } = await pool.query(
    `select id, email, phone from users where role = 'admin' and email is not null`
  );
  return rows.map((r) => ({ userId: r.id, email: r.email, phone: r.phone }));
}

// ---- Outbound audit trail ----
// Every send attempt (sent / skipped / failed) lands in outbound_messages.
// SMSGo pre-approval appears here as `skipped` — the dry-run record.

async function recordOutbound({ channel, to, key, status, error, providerRef }) {
  if (!to) return;
  try {
    await pool.query(
      `insert into outbound_messages (channel, message_key, recipient, status, error, provider_ref)
       values ($1, $2, $3, $4, $5, $6)`,
      [channel, key, String(to), status, error || null, providerRef || null]
    );
  } catch (err) {
    logger.error(`Failed to record outbound ${key} ${channel}: ${err.message}`);
  }
}

// ---- Recipient resolution ----

function recipientsForBooking(payload, role) {
  const b = payload.booking;
  if (!b) return [];
  if (role === 'player') {
    const phone = b.player_phone || b.user_phone;
    if (!b.user_email && !phone) return [];
    return [{ userId: b.user_id, email: b.user_email, phone }];
  }
  if (role === 'owner') {
    if (!b.owner_email && !b.owner_phone) return [];
    return [{ userId: b.venue_owner_id, email: b.owner_email, phone: b.owner_phone }];
  }
  return [];
}

function recipientsForRegistration(payload, role) {
  const r = payload.registration;
  if (!r || role !== 'player') return [];
  if (!r.player_email && !r.player_phone) return [];
  return [{ userId: r.user_id, email: r.player_email, phone: r.player_phone }];
}

async function recipientsForEventCancelled(payload, role) {
  const e = payload.event;
  if (!e) return [];
  if (role === 'registrant') return loadEventRegistrants(e.id);
  if (role === 'organizer') {
    return e.organizer_email ? [{ userId: e.organizer_id, email: e.organizer_email, phone: e.organizer_phone }] : [];
  }
  return [];
}

async function resolveRecipients(payload, key, role) {
  const def = MESSAGES[key];
  if (def?.recipients) return def.recipients(payload, role);
  if (role === 'admin') return loadAdmins();
  return [];
}

// ---- Message registry ----
// key -> { email?: [roles], sms?: [roles], inApp?: [roles],
//          recipients(payload, role), buildInApp?, buildEmail?, buildSms? }
// Builders return null to skip (no recipient reachable); email builders may
// return `to` to override the resolved recipient (bill flow).

const MESSAGES = {
  'booking.confirmed': {
    email: ['player', 'owner'],
    sms: ['player', 'owner'],
    inApp: ['player'],
    recipients: recipientsForBooking,
    buildInApp: () => ({ type: 'booking_confirmed', title: 'Booking confirmed', body: 'Your booking has been confirmed.' }),
    buildEmail: (ctx, role) => {
      if (role === 'owner') {
        const built = emailService.buildOwnerBookingHtml(ctx.payload.booking, ctx.brand);
        return { subject: `New booking — ${ctx.payload.booking.venue_name || 'your venue'}`, html: built.html, text: built.text };
      }
      const first = firstNameOf(ctx.payload.booking);
      const built = emailService.buildBookingHtml(ctx.payload.booking, ctx.brand, ctx.qr ? { qr: { cid: ctx.qr.cid } } : {});
      return {
        subject: first
          ? `${first}, your court at ${ctx.payload.booking.venue_name || 'the venue'} is booked`
          : `Booking confirmed — ${ctx.payload.booking.venue_name || 'your slot'}`,
        html: built.html,
        text: built.text,
        attachments: ctx.qr ? [{ filename: 'booking-qr.png', content: ctx.qr.png, contentType: 'image/png', inline: true }] : []
      };
    },
    buildSms: (ctx, role) => role === 'player'
      ? smsService.buildBookingSms(ctx.payload.booking, ctx.brand)
      : smsService.buildOwnerBookingSms(ctx.payload.booking, ctx.brand)
  },

  'booking.reminder': {
    email: ['player'],
    sms: ['player'],
    recipients: recipientsForBooking,
    buildEmail: (ctx) => {
      const first = firstNameOf(ctx.payload.booking);
      const built = emailService.buildReminderHtml(ctx.payload.booking, ctx.brand, ctx.qr ? { qr: { cid: ctx.qr.cid } } : {});
      return {
        subject: first
          ? `Reminder, ${first} — your booking at ${ctx.payload.booking.venue_name || 'the venue'} is tomorrow`
          : `Reminder — ${ctx.payload.booking.venue_name || 'your booking'} tomorrow`,
        html: built.html,
        text: built.text,
        attachments: ctx.qr ? [{ filename: 'booking-qr.png', content: ctx.qr.png, contentType: 'image/png', inline: true }] : []
      };
    },
    buildSms: (ctx) => smsService.buildReminderSms(ctx.payload.booking, ctx.brand)
  },

  'booking.bill': {
    email: ['player'],
    recipients: (payload) => (payload.bookingId ? [{ bookingId: payload.bookingId }] : []),
    buildEmail: async (ctx) => {
      const billService = require('./billService');
      const booking = await billService.loadBookingForBill(ctx.payload.bookingId);
      if (!booking) return null;
      if (booking.user_id === booking.venue_owner_id || !booking.user_email) return null;
      const pdf = await billService.bookingBillPdf(ctx.payload.bookingId);
      if (!pdf) return null;
      const attachments = [{ filename: `spots-bill-${booking.id.slice(0, 8)}.pdf`, content: pdf, contentType: 'application/pdf' }];
      let qr;
      if (booking.qr_token) qr = { cid: 'booking-qr.png', png: await emailTemplates.qrPng(booking.qr_token) };
      const built = emailService.buildBillHtml(booking, ctx.brand, qr ? { qr: { cid: qr.cid } } : {});
      if (qr) attachments.push({ filename: 'booking-qr.png', content: qr.png, contentType: 'image/png', inline: true });
      return {
        to: booking.user_email,
        subject: `Your bill — ${booking.venue_name || 'booking'}`,
        html: built.html,
        text: built.text,
        attachments
      };
    }
  },

  'event.bill': {
    email: ['player'],
    recipients: (payload) => (payload.registrationId ? [{ registrationId: payload.registrationId }] : []),
    buildEmail: async (ctx) => {
      const billService = require('./billService');
      const reg = await billService.loadRegistrationForBill(ctx.payload.registrationId);
      if (!reg || !reg.player_email) return null;
      const pdf = await billService.registrationBillPdf(ctx.payload.registrationId);
      if (!pdf) return null;
      const built = emailService.buildRegistrationBillHtml(reg, ctx.brand);
      return {
        to: reg.player_email,
        subject: `Your bill — ${reg.event_name || 'event registration'}`,
        html: built.html,
        text: built.text,
        attachment: { filename: `spots-event-bill-${reg.id.slice(0, 8)}.pdf`, content: pdf, contentType: 'application/pdf' }
      };
    }
  },

  'booking.cancelled.player': {
    email: ['player', 'owner'],
    sms: ['player', 'owner'],
    inApp: ['player'],
    recipients: recipientsForBooking,
    buildInApp: () => ({ type: 'booking_cancelled', title: 'Booking cancelled', body: 'Your booking has been cancelled.' }),
    buildEmail: (ctx, role) => {
      if (role === 'owner') {
        const built = emailService.buildOwnerBookingCancelledHtml(ctx.payload.booking, ctx.brand);
        return { subject: `Booking cancelled — ${ctx.payload.booking.venue_name || 'your venue'}`, html: built.html, text: built.text };
      }
      const first = firstNameOf(ctx.payload.booking);
      const built = emailService.buildPlayerCancelledHtml(ctx.payload.booking, ctx.payload.refund, ctx.brand);
      return {
        subject: first
          ? `${first}, your booking at ${ctx.payload.booking.venue_name || 'the venue'} was cancelled`
          : `Booking cancelled — ${ctx.payload.booking.venue_name || 'your booking'}`,
        html: built.html,
        text: built.text
      };
    },
    buildSms: (ctx, role) => role === 'player'
      ? smsService.buildPlayerCancelledSms(ctx.payload.booking, ctx.brand)
      : smsService.buildOwnerBookingCancelledSms(ctx.payload.booking, ctx.brand)
  },

  'booking.cancelled.owner': {
    email: ['player'],
    sms: ['player'],
    inApp: ['player'],
    recipients: recipientsForBooking,
    buildInApp: () => ({ type: 'booking_cancelled', title: 'Booking cancelled', body: 'Your booking has been cancelled by the venue.' }),
    buildEmail: (ctx) => {
      const built = emailService.buildVenueCancelledHtml(ctx.payload.booking, ctx.brand);
      return { subject: `Booking cancelled — ${ctx.payload.booking.venue_name || 'your booking'}`, html: built.html, text: built.text };
    },
    buildSms: (ctx) => smsService.buildVenueCancelledSms(ctx.payload.booking, ctx.brand)
  },

  'booking.cancelled.admin': {
    email: ['player'],
    sms: ['player'],
    inApp: ['player'],
    recipients: recipientsForBooking,
    buildInApp: () => ({ type: 'booking_cancelled', title: 'Booking cancelled', body: 'Your booking has been cancelled.' }),
    buildEmail: (ctx) => {
      const built = emailService.buildVenueCancelledHtml(ctx.payload.booking, ctx.brand);
      return { subject: `Booking cancelled — ${ctx.payload.booking.venue_name || 'your booking'}`, html: built.html, text: built.text };
    },
    buildSms: (ctx) => smsService.buildVenueCancelledSms(ctx.payload.booking, ctx.brand)
  },

  'booking.walkin_created': {
    sms: ['player'],
    recipients: recipientsForBooking,
    buildSms: (ctx) => smsService.buildWalkinSms(ctx.payload.booking, ctx.brand)
  },

  'event.registered': {
    email: ['player'],
    sms: ['player'],
    inApp: ['player'],
    recipients: recipientsForRegistration,
    buildInApp: (ctx) => ({ type: 'event_registered', title: 'Registration confirmed', body: `You're registered for ${ctx.payload.registration.event_name || 'the event'}.` }),
    buildEmail: (ctx) => {
      const built = emailService.buildEventRegisteredHtml(ctx.payload.registration, ctx.brand);
      return { subject: `You're in — ${ctx.payload.registration.event_name || 'the event'}`, html: built.html, text: built.text };
    },
    buildSms: (ctx) => smsService.buildEventRegisteredSms(ctx.payload.registration, ctx.brand)
  },

  'event.cancelled': {
    email: ['registrant', 'organizer'],
    sms: ['registrant'],
    inApp: ['registrant'],
    recipients: recipientsForEventCancelled,
    buildInApp: (ctx) => ({ type: 'event_cancelled', title: 'Event cancelled', body: `The event ${ctx.payload.event.name || ''} has been cancelled.` }),
    buildEmail: (ctx, role) => {
      if (role === 'organizer') {
        const built = emailService.buildEventCancelledOwnerHtml(ctx.payload.event, ctx.brand);
        return { subject: `Event cancelled — ${ctx.payload.event.name || 'your event'}`, html: built.html, text: built.text };
      }
      const built = emailService.buildEventCancelledHtml({ event_name: ctx.payload.event.name, event_start: ctx.payload.event.start_at }, ctx.brand);
      return { subject: `Event cancelled — ${ctx.payload.event.name || ''}`, html: built.html, text: built.text };
    },
    buildSms: (ctx) => smsService.buildEventCancelledSms({ event_name: ctx.payload.event.name, event_start: ctx.payload.event.start_at }, ctx.brand)
  },

  'signup.welcome': {
    email: ['player'],
    recipients: (payload) => {
      const u = payload.user;
      return u?.email ? [{ userId: u.id, email: u.email }] : [];
    },
    buildEmail: (ctx) => {
      const built = emailService.buildWelcomeHtml(ctx.brand);
      return { subject: `Welcome to ${ctx.brand}`, html: built.html, text: built.text };
    }
  },

  'venue.approved': {
    email: ['owner'],
    recipients: (payload) => (payload.ownerEmail ? [{ email: payload.ownerEmail }] : []),
    buildEmail: (ctx) => {
      const built = emailService.buildVenueApprovedHtml(ctx.payload.venue, ctx.brand);
      return { subject: `Your venue "${ctx.payload.venue.name || ''}" is live!`, html: built.html, text: built.text };
    }
  },

  'venue.rejected': {
    email: ['owner'],
    recipients: (payload) => (payload.ownerEmail ? [{ email: payload.ownerEmail }] : []),
    buildEmail: (ctx) => {
      const built = emailService.buildVenueRejectedHtml(ctx.payload.venue, ctx.payload.reason, ctx.brand);
      return { subject: `Update on your venue "${ctx.payload.venue.name || ''}"`, html: built.html, text: built.text };
    }
  },

  'site.request.status': {
    email: ['owner'],
    inApp: ['owner'],
    recipients: (payload) => (payload.owner?.email ? [{ userId: payload.owner.id, email: payload.owner.email }] : []),
    buildInApp: (ctx) => {
      const r = ctx.payload.request || {};
      return {
        type: 'site_request_status',
        title: r.status === 'live' ? 'Your dedicated site is live' : 'Site request update',
        body: `${r.hostname || 'Your site'} — ${r.status === 'rejected' ? r.rejection_reason || 'rejected' : r.status}.`
      };
    },
    buildEmail: (ctx) => {
      const r = ctx.payload.request || {};
      const business = ctx.payload.business?.name || 'your business';
      const hostname = r.hostname || '';
      const statusLabels = {
        requested: `Your request for ${hostname} is in review.`,
        approved: `Great news — ${hostname} is approved. Add the DNS record below, then confirm in your console.`,
        dns_pending: `We're watching for your DNS record on ${hostname}.`,
        verifying: `DNS verified — we're completing the last steps.`,
        live: `${hostname} is live! Your dedicated site is ready — share it with the world.`,
        rejected: `Your request for ${hostname} was not approved`
      };
      const statusText = statusLabels[r.status] || `Your site request for ${hostname} moved to "${r.status}".`;

      let dnsBlock = '';
      if (r.status === 'approved' && r.dns_name && r.dns_value) {
        dnsBlock = `
          <div class="ms-card" style="margin:18px 0;padding:16px;border-radius:16px;background:#fafaf7;border:1px solid #ececea;">
            <p class="ms-ink" style="margin:0 0 6px;font-weight:800;">Add this DNS record on <span style="font-family:monospace">${emailTemplates.escapeHtml(r.dns_name)}</span></p>
            <p class="ms-muted" style="margin:0 0 8px;color:#8a8a85;font-size:12px;">Type: <span style="font-family:monospace">${emailTemplates.escapeHtml(r.dns_type)}</span> — Value: <span style="font-family:monospace">${emailTemplates.escapeHtml(r.dns_value)}</span></p>
            <p class="ms-muted" style="margin:0;color:#8a8a85;font-size:12px;">Once added, click "I've added the record" in your console and we'll verify automatically.</p>
          </div>`;
      }

      let rejection = '';
      if (r.status === 'rejected' && r.rejection_reason) {
        rejection = `<p class="ms-ink2" style="margin:8px 0 0;font-size:14px;">Reason: ${emailTemplates.escapeHtml(r.rejection_reason)}</p>
          <p class="ms-ink2" style="margin:8px 0 0;font-size:14px;">You can edit your request and submit again — find it under <strong>Widget &amp; site</strong> in your console.</p>`;
      }

      const html = emailTemplates.shell({
        brand: ctx.brand,
        preheader: statusText,
        content: `
          <h1 class="ms-ink" style="margin:0 0 8px;color:#1c1c1a;font-size:22px;font-weight:800;line-height:1.25;">${ctx.payload.business?.name ? `<span style="color:#8a8a85;font-size:14px;font-weight:600;letter-spacing:.04em;">${emailTemplates.escapeHtml(ctx.payload.business.name).toUpperCase()}</span><br/>` : ''}${statusText}</h1>
          ${dnsBlock}
          ${rejection}
          <p class="ms-muted" style="margin:16px 0 0;color:#8a8a85;font-size:13px;">Track your request live under <strong>Widget &amp; site → Dedicated site</strong> in your console.</p>`,
        plainText: `${statusText}${dnsBlock ? `\n\nDNS record to add on ${r.dns_name}:\nType: ${r.dns_type}\nValue: ${r.dns_value}` : ''}${rejection ? `\n\n${rejection.replace(/<[^>]+>/g, '')}` : ''}`
      });
      const subject = hostname
        ? `${hostname} — ${{ requested: 'site request submitted', approved: 'add your DNS record', dns_pending: 'DNS record pending', verifying: 'verifying your site', live: 'your dedicated site is live', rejected: 'site request not approved' }[r.status] || 'site update'}`
        : 'Site request update';
      return { subject, html, text: html };
    }
  },

  'owner.welcome': {
    email: ['owner'],
    recipients: (payload) => (payload.owner?.email ? [{ userId: payload.owner.id, email: payload.owner.email }] : []),
    buildEmail: async (ctx) => {
      const { owner, password, plan, agreement, bankDetails } = ctx.payload;
      let attachment;
      if (agreement) {
        try {
          const { renderAgreementPdf } = require('./agreementService');
          const pdf = await renderAgreementPdf(agreement, plan);
          attachment = { filename: `owner-agreement-${owner.email.split('@')[0]}.pdf`, content: pdf, contentType: 'application/pdf' };
        } catch (err) {
          logger.error(`Agreement PDF failed: ${err.message}`);
        }
      }
      const built = emailService.buildOwnerWelcomeHtml(owner, password, plan, bankDetails, ctx.brand);
      return { subject: 'Your venue-owner account is ready', html: built.html, text: built.text, attachment };
    }
  },

  'owner.renewal': {
    email: ['owner'],
    recipients: (payload) => (payload.owner?.email ? [{ userId: payload.owner.id, email: payload.owner.email }] : []),
    buildEmail: async (ctx) => {
      const { owner, plan, agreement, bankDetails } = ctx.payload;
      let attachment;
      if (agreement) {
        try {
          const { renderAgreementPdf } = require('./agreementService');
          const pdf = await renderAgreementPdf(agreement, plan);
          attachment = { filename: `owner-agreement-${owner.email.split('@')[0]}.pdf`, content: pdf, contentType: 'application/pdf' };
        } catch (err) {
          logger.error(`Agreement PDF failed: ${err.message}`);
        }
      }
      const built = emailService.buildOwnerRenewalHtml(owner, plan, bankDetails, ctx.brand);
      return { subject: 'Your plan has been renewed', html: built.html, text: built.text, attachment };
    }
  },

  'owner.nudge': {
    email: ['owner'],
    recipients: (payload) => (payload.owner?.email ? [{ userId: payload.owner.id, email: payload.owner.email }] : []),
    buildEmail: (ctx) => {
      const built = emailService.buildOwnerNudgeHtml(ctx.payload.owner, ctx.payload.plan, ctx.payload.bankDetails, ctx.brand);
      return { subject: 'Your plan is ending soon', html: built.html, text: built.text };
    }
  },

  'lead.new': {
    email: ['admin'],
    inApp: ['admin'],
    recipients: async () => loadAdmins(),
    buildInApp: (ctx) => ({ type: 'owner_lead', title: 'New owner lead', body: `${ctx.payload.lead?.name || ''} wants to list a venue` }),
    buildEmail: (ctx) => {
      const html = emailTemplates.shell({
        brand: ctx.brand,
        preheader: `New owner lead: ${ctx.payload.lead?.name || ''}`,
        content: `
          <h1 class="ms-ink" style="margin:0 0 8px;color:${emailTemplates.C.ink};font-size:22px;font-weight:800;line-height:1.25;">New owner lead</h1>
          <p class="ms-ink2" style="margin:0 0 20px;color:${emailTemplates.C.ink2};font-size:15px;"><strong>${emailTemplates.escapeHtml(ctx.payload.lead?.name || '')}</strong> (${emailTemplates.escapeHtml(ctx.payload.lead?.email || '')}) wants to list a venue${ctx.payload.lead?.venue_name ? ` — "${emailTemplates.escapeHtml(ctx.payload.lead.venue_name)}"` : ''}.</p>
          <p class="ms-muted" style="margin:0;color:${emailTemplates.C.ink2};font-size:13px;">Open the Leads tab in the console to review and convert this lead.</p>`,
        plainText: `New owner lead: ${ctx.payload.lead?.name || ''} (${ctx.payload.lead?.email || ''}) wants to list a venue${ctx.payload.lead?.venue_name ? ` — "${ctx.payload.lead.venue_name}"` : ''}.`
      });
      return { subject: `New owner lead: ${ctx.payload.lead?.name || ''}`, html };
    }
  },

  'digest.daily': {
    email: ['admin'],
    recipients: async () => loadAdmins(),
    buildEmail: (ctx) => ({
      subject: `${ctx.brand} daily digest — ${ctx.payload.day}`,
      html: ctx.payload.html
    })
  }
};

// ---- Channel senders ----

async function resolveRecipientsSafe(payload, key, role) {
  try {
    return await resolveRecipients(payload, key, role);
  } catch (err) {
    logger.error(`Recipient resolution failed for ${key} ${role}: ${err.message}`);
    return [];
  }
}

async function sendEmailChannel({ key, to, content }) {
  const outcome = { channel: 'email', key, to, success: false, status: 'failed' };
  try {
    const payload = { to, subject: content.subject, html: content.html };
    if (content.text) payload.text = content.text;
    const allAttachments = [...(content.attachments || []), ...(content.attachment ? [content.attachment] : [])];
    if (allAttachments.length) payload.attachments = allAttachments;
    const result = await emailService.sendEmail(payload);
    if (result.success) {
      outcome.success = true;
      outcome.status = 'sent';
    } else {
      outcome.status = result.error === 'Email not configured' ? 'skipped' : 'failed';
      outcome.error = result.error;
    }
    if (result.id) outcome.providerRef = result.id;
  } catch (err) {
    outcome.status = 'failed';
    outcome.error = err.message;
  }
  await recordOutbound({ channel: 'email', to, key, status: outcome.status, error: outcome.error, providerRef: outcome.providerRef });
  return outcome;
}

async function sendSmsChannel({ key, to, message }) {
  const outcome = { channel: 'sms', key, to, success: false, status: 'skipped' };
  const smsEvents = await getSmsEvents();
  if (smsEvents !== null && !smsEvents.includes(key)) {
    outcome.error = 'sms_events gate';
    await recordOutbound({ channel: 'sms', to, key, status: 'skipped', error: 'sms_events gate' });
    return outcome;
  }
  const normalizedTo = smsService.formatSriLankanPhone(to);
  try {
    const result = await smsService.sendSms({ to: normalizedTo, message });
    if (result.success) {
      outcome.success = true;
      outcome.status = 'sent';
    } else {
      outcome.status = ['SMS disabled', 'SMS not configured'].includes(result.error) ? 'skipped' : 'failed';
      outcome.error = result.error;
    }
    if (result.id) outcome.providerRef = result.id;
  } catch (err) {
    outcome.status = 'failed';
    outcome.error = err.message;
  }
  await recordOutbound({ channel: 'sms', to: normalizedTo, key, status: outcome.status, error: outcome.error, providerRef: outcome.providerRef });
  return outcome;
}

// ---- Dispatch ----

/**
 * Fan a message out to its channel plan. In-app rows + audit rows are awaited
 * (cheap local DB writes). Email/SMS transports run detached by default so the
 * request never blocks on a provider; pass `{ awaitTransports: true }` when the
 * caller needs the send results (reminder job, bill emails, tests).
 * Never throws — unknown keys log and return [].
 */
async function dispatch(key, payload, opts = {}) {
  const def = MESSAGES[key];
  if (!def) {
    logger.error(`Unknown notification key: ${key}`);
    return [];
  }

  const results = [];

  if (def.inApp) {
    for (const role of def.inApp) {
      const recipients = await resolveRecipientsSafe(payload, key, role);
      for (const rec of recipients) {
        if (!rec.userId) continue;
        let built = null;
        try {
          built = await def.buildInApp({ payload, role, key });
        } catch (err) {
          logger.error(`In-app builder failed for ${key}: ${err.message}`);
        }
        if (!built) continue;
        try {
          await pool.query(
            `insert into notifications (user_id, type, title, body) values ($1, $2, $3, $4)`,
            [rec.userId, built.type || key, built.title, built.body]
          );
        } catch (err) {
          logger.error(`In-app insert failed for ${key}: ${err.message}`);
        }
      }
    }
  }

  const runTransports = async () => {
    const brand = await getBrandName();

    const sendEmailCatch = async (role) => {
      try {
        const recipients = await resolveRecipients(payload, key, role);
        for (const rec of recipients) {
          let content = null;
          try {
            // QR (booking.confirmed/reminder): load the token only for the
            // player recipient of the booking — never for owner/admin roles.
            const ctx = { payload, key, role, brand, qr: null };
            if (role === 'player' && QR_KEYS.has(key) && rec.email === payload.booking?.user_email && payload.booking?.id) {
              try {
                const token = await loadQrToken(payload.booking.id);
                if (token) ctx.qr = { cid: 'booking-qr.png', png: await emailTemplates.qrPng(token) };
              } catch (err) {
                logger.error(`QR load failed for ${key} player email (sent without QR): ${err.message}`);
              }
            }
            content = await def.buildEmail(ctx, role);
          } catch (err) {
            logger.error(`Email builder failed for ${key} ${role}: ${err.message}`);
          }
          if (!content) continue;
          const to = content.to || rec.email;
          if (!to) continue;
          results.push(await sendEmailChannel({ key, to, content }));
        }
      } catch (err) {
        logger.error(`Email recipient resolution failed for ${key} ${role}: ${err.message}`);
      }
    };

    const sendSmsCatch = async (role) => {
      try {
        const recipients = await resolveRecipients(payload, key, role);
        for (const rec of recipients) {
          if (!rec.phone) continue;
          let message = null;
          try {
            // QR SMS (booking.confirmed/reminder): the player's SMS carries
            // the QR link (the token is loaded only for the player recipient,
            // never owner/admin roles). The SMS text is the bearer disclosure.
            const ctx = { payload, key, role, brand, qrUrl: null };
            if (role === 'player' && QR_KEYS.has(key) && rec.phone === payload.booking?.user_phone && payload.booking?.id) {
              try {
                const token = await loadQrToken(payload.booking.id);
                if (token) ctx.qrUrl = smsService.bookingQrUrl(payload.booking.id, token);
              } catch (err) {
                logger.error(`QR SMS link load failed for ${key} player (sent without link): ${err.message}`);
              }
            }
            message = await def.buildSms(ctx, role);
          } catch (err) {
            logger.error(`SMS builder failed for ${key} ${role}: ${err.message}`);
          }
          if (!message) continue;
          results.push(await sendSmsChannel({ key, to: rec.phone, message }));
        }
      } catch (err) {
        logger.error(`SMS recipient resolution failed for ${key} ${role}: ${err.message}`);
      }
    };

    if (def.email) {
      for (const role of def.email) {
        await sendEmailCatch(role);
      }
    }

    if (def.sms) {
      for (const role of def.sms) {
        await sendSmsCatch(role);
      }
    }
  };

  if (opts.awaitTransports || process.env.NODE_ENV === 'test') {
    await runTransports();
  } else {
    runTransports().catch((err) => {
      logger.error(`Notification background dispatch failed for ${key}: ${err.message}`);
    });
  }

  return results;
}

// Load a booking and dispatch a booking-key message. Extra payload fields
// (e.g. refund amount for cancellations) are merged in.
async function dispatchBooking(key, bookingId, extra = {}, opts = {}) {
  const booking = await loadBookingForEvents(bookingId);
  if (!booking) return [];
  return dispatch(key, { booking, ...extra }, opts);
}

async function dispatchEventRegistration(key, registrationId, opts = {}) {
  const registration = await loadEventRegistration(registrationId);
  if (!registration) return [];
  return dispatch(key, { registration }, opts);
}

async function dispatchEventCancelled(eventId, opts = {}) {
  const event = await loadEvent(eventId);
  if (!event) return [];
  return dispatch('event.cancelled', { event }, opts);
}

module.exports = {
  MESSAGES,
  dispatch,
  dispatchBooking,
  dispatchEventRegistration,
  dispatchEventCancelled,
  recordOutbound
};