const pool = require('../db');
const logger = require('./logger');
const emailService = require('./emailService');
const smsService = require('./smsService');
const { getBrandName, getSmsEvents } = require('./featureFlags');
const { loadBookingForEvents } = require('./bookingLoader');

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
    buildEmail: (ctx, role) => role === 'player'
      ? { subject: `Booking confirmed — ${ctx.payload.booking.venue_name || 'your slot'}`, html: emailService.buildBookingHtml(ctx.payload.booking, ctx.brand) }
      : { subject: `New booking — ${ctx.payload.booking.venue_name || 'your venue'}`, html: emailService.buildOwnerBookingHtml(ctx.payload.booking, ctx.brand) },
    buildSms: (ctx, role) => role === 'player'
      ? smsService.buildBookingSms(ctx.payload.booking, ctx.brand)
      : smsService.buildOwnerBookingSms(ctx.payload.booking, ctx.brand)
  },

  'booking.reminder': {
    email: ['player'],
    sms: ['player'],
    recipients: recipientsForBooking,
    buildEmail: (ctx) => ({ subject: `Reminder — ${ctx.payload.booking.venue_name || 'your booking'} tomorrow`, html: emailService.buildReminderHtml(ctx.payload.booking, ctx.brand) }),
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
      return {
        to: booking.user_email,
        subject: `Your bill — ${booking.venue_name || 'booking'}`,
        html: emailService.buildBillHtml(booking, ctx.brand),
        attachment: { filename: `spots-bill-${booking.id.slice(0, 8)}.pdf`, content: pdf, contentType: 'application/pdf' }
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
      return {
        to: reg.player_email,
        subject: `Your bill — ${reg.event_name || 'event registration'}`,
        html: emailService.buildRegistrationBillHtml(reg, ctx.brand),
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
    buildEmail: (ctx, role) => role === 'player'
      ? { subject: `Booking cancelled — ${ctx.payload.booking.venue_name || 'your booking'}`, html: emailService.buildPlayerCancelledHtml(ctx.payload.booking, ctx.payload.refund, ctx.brand) }
      : { subject: `Booking cancelled — ${ctx.payload.booking.venue_name || 'your venue'}`, html: emailService.buildOwnerBookingCancelledHtml(ctx.payload.booking, ctx.brand) },
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
    buildEmail: (ctx) => ({ subject: `Booking cancelled — ${ctx.payload.booking.venue_name || 'your booking'}`, html: emailService.buildVenueCancelledHtml(ctx.payload.booking, ctx.brand) }),
    buildSms: (ctx) => smsService.buildVenueCancelledSms(ctx.payload.booking, ctx.brand)
  },

  'booking.cancelled.admin': {
    email: ['player'],
    sms: ['player'],
    inApp: ['player'],
    recipients: recipientsForBooking,
    buildInApp: () => ({ type: 'booking_cancelled', title: 'Booking cancelled', body: 'Your booking has been cancelled.' }),
    buildEmail: (ctx) => ({ subject: `Booking cancelled — ${ctx.payload.booking.venue_name || 'your booking'}`, html: emailService.buildVenueCancelledHtml(ctx.payload.booking, ctx.brand) }),
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
    buildEmail: (ctx) => ({ subject: `You're in — ${ctx.payload.registration.event_name || 'the event'}`, html: emailService.buildEventRegisteredHtml(ctx.payload.registration, ctx.brand) }),
    buildSms: (ctx) => smsService.buildEventRegisteredSms(ctx.payload.registration, ctx.brand)
  },

  'event.cancelled': {
    email: ['registrant', 'organizer'],
    sms: ['registrant'],
    inApp: ['registrant'],
    recipients: recipientsForEventCancelled,
    buildInApp: (ctx) => ({ type: 'event_cancelled', title: 'Event cancelled', body: `The event ${ctx.payload.event.name || ''} has been cancelled.` }),
    buildEmail: (ctx, role) => role === 'organizer'
      ? { subject: `Event cancelled — ${ctx.payload.event.name || 'your event'}`, html: emailService.buildEventCancelledOwnerHtml(ctx.payload.event, ctx.brand) }
      : { subject: `Event cancelled — ${ctx.payload.event.name || ''}`, html: emailService.buildEventCancelledHtml({ event_name: ctx.payload.event.name, event_start: ctx.payload.event.start_at }, ctx.brand) },
    buildSms: (ctx) => smsService.buildEventCancelledSms({ event_name: ctx.payload.event.name, event_start: ctx.payload.event.start_at }, ctx.brand)
  },

  'signup.welcome': {
    email: ['player'],
    recipients: (payload) => {
      const u = payload.user;
      return u?.email ? [{ userId: u.id, email: u.email }] : [];
    },
    buildEmail: (ctx) => ({ subject: `Welcome to ${ctx.brand}`, html: emailService.buildWelcomeHtml(ctx.brand) })
  },

  'venue.approved': {
    email: ['owner'],
    recipients: (payload) => (payload.ownerEmail ? [{ email: payload.ownerEmail }] : []),
    buildEmail: (ctx) => ({ subject: `Your venue "${ctx.payload.venue.name || ''}" is live!`, html: emailService.buildVenueApprovedHtml(ctx.payload.venue, ctx.brand) })
  },

  'venue.rejected': {
    email: ['owner'],
    recipients: (payload) => (payload.ownerEmail ? [{ email: payload.ownerEmail }] : []),
    buildEmail: (ctx) => ({ subject: `Update on your venue "${ctx.payload.venue.name || ''}"`, html: emailService.buildVenueRejectedHtml(ctx.payload.venue, ctx.payload.reason, ctx.brand) })
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
      return {
        subject: 'Your venue-owner account is ready',
        html: emailService.buildOwnerWelcomeHtml(owner, password, plan, bankDetails, ctx.brand),
        attachment
      };
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
      return {
        subject: 'Your plan has been renewed',
        html: emailService.buildOwnerRenewalHtml(owner, plan, bankDetails, ctx.brand),
        attachment
      };
    }
  },

  'owner.nudge': {
    email: ['owner'],
    recipients: (payload) => (payload.owner?.email ? [{ userId: payload.owner.id, email: payload.owner.email }] : []),
    buildEmail: (ctx) => ({
      subject: 'Your plan is ending soon',
      html: emailService.buildOwnerNudgeHtml(ctx.payload.owner, ctx.payload.plan, ctx.payload.bankDetails, ctx.brand)
    })
  },

  'lead.new': {
    email: ['admin'],
    inApp: ['admin'],
    recipients: async () => loadAdmins(),
    buildInApp: (ctx) => ({ type: 'owner_lead', title: 'New owner lead', body: `${ctx.payload.lead?.name || ''} wants to list a venue` }),
    buildEmail: (ctx) => ({
      subject: `New owner lead: ${ctx.payload.lead?.name || ''}`,
      html: emailService.shell(`
        <h2 style="color:#176036;">New owner lead</h2>
        <p><strong>${emailService.escapeHtml(ctx.payload.lead?.name || '')}</strong> (${emailService.escapeHtml(ctx.payload.lead?.email || '')}) wants to list a venue${ctx.payload.lead?.venue_name ? ` — "${emailService.escapeHtml(ctx.payload.lead.venue_name)}"` : ''}.</p>
        <p style="color:#666;">Open the Leads tab in the console to review and convert this lead.</p>`, ctx.brand)
    })
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
    if (content.attachment) payload.attachment = content.attachment;
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
            content = await def.buildEmail({ payload, key, role, brand }, role);
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
            message = await def.buildSms({ payload, key, role, brand }, role);
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