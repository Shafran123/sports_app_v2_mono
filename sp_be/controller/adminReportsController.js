const pool = require('../db');
const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');

const RANGES = { 7: 7, 30: 30, 90: 90 };

// One parametrized window so every report shares the same definition:
// paid payments from `days` days ago (Asia/Colombo boundaries, no DST) forward.
function windowStart(days) {
  const d = new Date(Date.now() + (5 * 60 + 30) * 60 * 1000);
  const iso = d.toISOString().slice(0, 10);
  const start = new Date(`${iso}T00:00:00+05:30`);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start.toISOString();
}

exports.getReports = async (req, res) => {
  try {
    const range = RANGES[String(req.query.range || '7')] || 7;
    const since = windowStart(range);

    const { rows: series } = await pool.query(
      `select to_char((p.paid_at at time zone 'Asia/Colombo')::date, 'YYYY-MM-DD') as day,
              count(distinct p.booking_id)::int as bookings,
              coalesce(sum(p.amount - p.tax_amount) filter (where p.booking_id is not null), 0)::int as revenue,
              coalesce(sum(p.tax_amount) filter (where p.booking_id is not null), 0)::int as tax
       from payments p
       where p.status = 'paid' and p.paid_at >= $1 and p.booking_id is not null
       group by day
       order by day`,
      [since]
    );

    const { rows: bySport } = await pool.query(
      `select s.slug, s.name, count(distinct b.id)::int as bookings,
              coalesce(sum(p.amount - p.tax_amount), 0)::int as revenue
       from payments p
       join bookings b on b.id = p.booking_id
       join courts c on c.id = b.court_id
       join sports s on s.id = c.sport_id
       where p.status = 'paid' and p.paid_at >= $1
       group by s.slug, s.name
       order by revenue desc`,
      [since]
    );

    const { rows: byVenue } = await pool.query(
      `select v.name, count(distinct b.id)::int as bookings,
              coalesce(sum(p.amount - p.tax_amount), 0)::int as revenue
       from payments p
       join bookings b on b.id = p.booking_id
       join courts c on c.id = b.court_id
       join venues v on v.id = c.venue_id
       where p.status = 'paid' and p.paid_at >= $1
       group by v.name
       order by revenue desc`,
      [since]
    );

    const { rows: split } = await pool.query(
      `select p.payment_method,
              count(distinct b.id)::int as bookings,
              coalesce(sum(p.amount - p.tax_amount), 0)::int as revenue
       from payments p
       join bookings b on b.id = p.booking_id
       where p.status = 'paid' and p.paid_at >= $1
       group by p.payment_method`,
      [since]
    );

    const { rows: events } = await pool.query(
      `select count(*) filter (where r.status in ('paid', 'pending'))::int as registrations,
              coalesce(sum(p.amount - p.tax_amount) filter (where p.status = 'paid'), 0)::int as revenue
       from event_registrations r
       left join payments p on p.event_registration_id = r.id
       where r.created_at >= $1`,
      [since]
    );

    ok(res, 200, {
      range,
      series,
      by_sport: bySport,
      by_venue: byVenue,
      payment_split: { online: split.find((s) => s.payment_method === 'online') || { bookings: 0, revenue: 0 }, cash: split.find((s) => s.payment_method === 'cash') || { bookings: 0, revenue: 0 } },
      events: events[0] ? { registrations: events[0].registrations, revenue: events[0].revenue } : { registrations: 0, revenue: 0 }
    });
  } catch (error) {
    logger.error(`Error fetching admin reports: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

module.exports = exports;