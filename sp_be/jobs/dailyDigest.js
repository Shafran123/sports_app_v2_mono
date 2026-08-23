const pool = require('../db');
const logger = require('../utils/logger');
const { fmtLkr } = require('../utils/format');
const emailService = require('../utils/emailService');
const { getBrandName } = require('../utils/featureFlags');

// Daily admin digest: previous day's platform numbers as an HTML email,
// 06:00 Asia/Colombo. Sent to every admin account; fire-and-forget via
// Mailgun (no intra-day retry), still sent when metrics are zero.

const COLOMBO_OFFSET = (5 * 60 + 30) * 60 * 1000;

// "today" wall-clock date in Colombo (YYYY-MM-DD). Sri Lanka has no DST.
function colomboDate() {
  return new Date(Date.now() + COLOMBO_OFFSET).toISOString().slice(0, 10);
}

function dayBounds(day) {
  return [`${day}T00:00:00+05:30`, `${day}T23:59:59+05:30`];
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function table(title, headers, rows) {
  const head = headers.map((h) => `<th style="text-align:left;padding:6px 10px;background:#f0fdf4;border:1px solid #d8e8de;">${h}</th>`).join('');
  const body = rows
    .map((r) => `<tr>${r.map((c) => `<td style="padding:6px 10px;border:1px solid #e5e7eb;">${c}</td>`).join('')}</tr>`)
    .join('');
  return `<h3 style="color:#176036;">${title}</h3><table style="border-collapse:collapse;width:100%;"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

async function buildDigest(day) {
  const brand = await getBrandName();
  const [start, end] = dayBounds(day);

  const { rows: summary } = await pool.query(
    `select
       coalesce(sum(p.amount - p.tax_amount) filter (where p.booking_id is not null), 0)::int as revenue,
       coalesce(sum(p.tax_amount) filter (where p.booking_id is not null), 0)::int as tax_collected,
       count(distinct p.booking_id) filter (where p.booking_id is not null)::int as bookings,
       coalesce(sum(p.amount - p.tax_amount) filter (where p.event_registration_id is not null and p.status = 'paid'), 0)::int as event_revenue
     from payments p
     where p.status = 'paid' and p.paid_at >= $1 and p.paid_at < $2`,
    [start, end]
  );

  const { rows: bySport } = await pool.query(
    `select s.name,
            count(distinct b.id)::int as bookings,
            coalesce(sum(p.amount - p.tax_amount), 0)::int as revenue
     from payments p
     join bookings b on b.id = p.booking_id
     join courts c on c.id = b.court_id
     join sports s on s.id = c.sport_id
     where p.status = 'paid' and p.paid_at >= $1 and p.paid_at < $2
     group by s.name
     order by revenue desc`,
    [start, end]
  );

  const { rows: byVenue } = await pool.query(
    `select v.name,
            count(distinct b.id)::int as bookings,
            coalesce(sum(p.amount - p.tax_amount), 0)::int as revenue
     from payments p
     join bookings b on b.id = p.booking_id
     join courts c on c.id = b.court_id
     join venues v on v.id = c.venue_id
     where p.status = 'paid' and p.paid_at >= $1 and p.paid_at < $2
     group by v.name
     order by revenue desc
     limit 10`,
    [start, end]
  );

  const { rows: split } = await pool.query(
    `select p.payment_method, count(distinct b.id)::int as bookings
     from payments p
     join bookings b on b.id = p.booking_id
     where p.status = 'paid' and p.paid_at >= $1 and p.paid_at < $2
     group by p.payment_method`,
    [start, end]
  );

  const { rows: health } = await pool.query(
    `select
       (select count(*)::int from venues where status = 'pending') as pending_approvals,
       (select count(*)::int from users where phone_verified_at is null and role = 'player') as unverified_players`
  );

  const s = summary[0];
  const online = split.find((r) => r.payment_method === 'online') || { bookings: 0 };
  const cash = split.find((r) => r.payment_method === 'cash') || { bookings: 0 };

  const rows = [
    ['Net revenue (excl. tax)', fmtLkr(s.revenue)],
    ['Tax collected', fmtLkr(s.tax_collected)],
    ['Bookings paid', s.bookings],
    ['Event revenue', fmtLkr(s.event_revenue)],
    ['Online bookings', online.bookings],
    ['Cash bookings', cash.bookings],
    ['Pending venue approvals', health[0].pending_approvals],
    ['Unverified players', health[0].unverified_players]
  ];

  return emailService.shell(`
    <h2 style="color:#176036;">${brand} — Daily digest</h2>
    <p><strong>${day}</strong> (Asia/Colombo)</p>
    ${table('Summary', ['Metric', 'Value'], rows)}
    ${bySport.length ? table('Bookings by sport', ['Sport', 'Bookings', 'Revenue'], bySport.map((r) => [escapeHtml(r.name), r.bookings, fmtLkr(r.revenue)])) : ''}
    ${byVenue.length ? table('Revenue by venue (top 10)', ['Venue', 'Bookings', 'Revenue'], byVenue.map((r) => [escapeHtml(r.name), r.bookings, fmtLkr(r.revenue)])) : ''}
  `);
}

async function runDigest() {
  try {
    const day = colomboDate();
    const html = await buildDigest(day);
    const { rows } = await pool.query(`select email from users where role = 'admin' and email is not null`);
    const to = rows.map((r) => r.email).filter(Boolean);
    if (to.length === 0) {
      logger.info('Digest skipped: no admin emails configured');
      return;
    }
    await emailService.sendEmail({
      to,
      subject: `MySlot.LK daily digest — ${day}`,
      html
    });
  } catch (error) {
    logger.error(`Daily digest failed: ${error.message}`);
  }
}

// Schedule the digest for 06:06 Asia/Colombo; reschedules after each run.
// The wall-clock time of the next deadline is computed in Colombo time
// (offset constant — Sri Lanka has no DST), so the 6-minute guard is against
// clock drift between the server and the target moment, not a UTC mix-up.
const DIGEST_WALL_TIME = { hour: 6, minute: 6 };

function startDigestJob() {
  const scheduleNext = () => {
    const wallNow = new Date(Date.now() + COLOMBO_OFFSET);
    const nextWall = new Date(
      Date.UTC(wallNow.getUTCFullYear(), wallNow.getUTCMonth(), wallNow.getUTCDate(), DIGEST_WALL_TIME.hour, DIGEST_WALL_TIME.minute, 0)
    );
    let delay = nextWall.getTime() - wallNow.getTime();
    if (delay <= 0) delay += 24 * 3600 * 1000; // already past 06:06 today — tomorrow
    setTimeout(async () => {
      await runDigest();
      scheduleNext();
    }, delay);
  };
  scheduleNext();
  return { runDigest };
}

module.exports = { runDigest, startDigestJob, buildDigest, colomboDate };