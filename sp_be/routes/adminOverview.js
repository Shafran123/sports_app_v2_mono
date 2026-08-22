const express = require('express');
const pool = require('../db');
const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');

const router = express.Router();

// Colombo calendar date for "today" (the platform operates on Sri Lanka time).
function colomboToday() {
  return new Date().toLocaleString('en-CA', { timeZone: 'Asia/Colombo' }).slice(0, 10);
}

// Platform-wide numbers for the admin dashboard: paid revenue and live bookings
// for a day, plus venue-scale counts.
router.get('/overview', async (req, res) => {
  try {
    const date = req.query.date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
      ? req.query.date
      : colomboToday();

    const values = [`${date}T00:00:00+05:30`, `${date}T23:59:59+05:30`];

    const { rows } = await pool.query(
      `select
         coalesce(sum(p.amount), 0)::int as revenue_today,
         (select count(*)::int from bookings b where b.status in ('confirmed', 'checked_in', 'completed')
            and b.start_at >= $1 and b.start_at < $2) as bookings_today,
         (select count(*)::int from venues) as total_venues,
         (select count(*)::int from venues where status = 'pending') as pending_approvals
       from payments p
       join bookings b on b.id = p.booking_id
       where p.status = 'paid' and b.start_at >= $1 and b.start_at < $2`,
      values
    );

    ok(res, 200, { ...rows[0], date });
  } catch (error) {
    logger.error(`Error fetching admin overview: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
});

module.exports = router;