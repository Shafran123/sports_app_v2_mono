const pool = require('../db');
const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');

function isoColombo(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00+05:30`;
}

function dayOfWeekOf(dateStr) {
  // Noon local (+05:30) so the UTC date always matches the local date — using
  // local midnight would land on the previous UTC day and return the wrong weekday.
  return new Date(`${dateStr}T12:00:00+05:30`).getUTCDay();
}

function buildSlots(openTime, closeTime, durationMin, dateStr) {
  const slots = [];
  const [openH, openM] = openTime.split(':').map(Number);
  const [closeH, closeM] = closeTime.split(':').map(Number);

  let hour = openH;
  let minute = openM;

  while (hour * 60 + minute + durationMin <= closeH * 60 + closeM) {
    const start = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    let endMin = minute + durationMin;
    let endHour = hour + Math.floor(endMin / 60);
    endMin = endMin % 60;
    const end = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
    slots.push({ start_time: start, end_time: end });
    minute += durationMin;
    hour += Math.floor(minute / 60);
    minute = minute % 60;
  }

  return slots;
}

async function getOverlaps(courtIds, dayStart, dayEnd) {
  const [bookings, holds, blocks] = await Promise.all([
    pool.query(
      `select court_id, start_at, end_at from bookings
       where court_id = any($1)
         and status in ('confirmed', 'checked_in', 'completed', 'no_show')
         and tstzrange(start_at, end_at) && tstzrange($2, $3)`,
      [courtIds, dayStart, dayEnd]
    ),
    pool.query(
      `select court_id, start_at, end_at from holds
       where court_id = any($1) and expires_at > now()
         and tstzrange(start_at, end_at) && tstzrange($2, $3)`,
      [courtIds, dayStart, dayEnd]
    ),
    pool.query(
      `select court_id, start_at, end_at from blocks
       where court_id = any($1)
         and tstzrange(start_at, end_at) && tstzrange($2, $3)`,
      [courtIds, dayStart, dayEnd]
    )
  ]);

  const overlapMap = new Map();
  for (const row of bookings.rows) {
    if (!overlapMap.has(row.court_id)) overlapMap.set(row.court_id, []);
    overlapMap.get(row.court_id).push({ start: row.start_at, end: row.end_at, type: 'booking' });
  }
  for (const row of blocks.rows) {
    if (!overlapMap.has(row.court_id)) overlapMap.set(row.court_id, []);
    overlapMap.get(row.court_id).push({ start: row.start_at, end: row.end_at, type: 'block' });
  }
  for (const row of holds.rows) {
    if (!overlapMap.has(row.court_id)) overlapMap.set(row.court_id, []);
    overlapMap.get(row.court_id).push({ start: row.start_at, end: row.end_at, type: 'hold' });
  }
  return overlapMap;
}

exports.getAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return fail(res, 400, 'DATE_REQUIRED', 'date is required (YYYY-MM-DD)');
    }
    const parsed = new Date(`${date}T00:00:00+05:30`);
    if (Number.isNaN(parsed.getTime())) {
      return fail(res, 400, 'DATE_REQUIRED', 'date is required (YYYY-MM-DD)');
    }

    const { rows: venueRows } = await pool.query(
      `select id from venues where id = $1 and status = 'approved'`,
      [id]
    );
    if (venueRows.length === 0) {
      return fail(res, 404, 'VENUE_NOT_FOUND', 'Venue not found');
    }

    const dayOfWeek = dayOfWeekOf(date);

    const [hoursRes, courtsRes, configRes] = await Promise.all([
      pool.query(
        `select open_time, close_time from venue_hours where venue_id = $1 and day_of_week = $2`,
        [id, dayOfWeek]
      ),
      pool.query(
        `select c.id, c.name, c.price_per_slot, c.slot_duration_min, s.name as sport
         from courts c left join sports s on s.id = c.sport_id
         where c.venue_id = $1 and c.is_active
         order by c.name`,
        [id]
      ),
      pool.query(`select value from platform_config where key = 'advance_days'`)
    ]);

    if (hoursRes.rows.length === 0) {
      return ok(res, 200, { date, courts: [] });
    }

    const open_time = hoursRes.rows[0].open_time.slice(0, 5);
    const close_time = hoursRes.rows[0].close_time.slice(0, 5);
    const advanceDays = configRes.rows.length ? Number(configRes.rows[0].value) : 14;

    const dayStart = isoColombo(date, open_time);
    const dayEnd = isoColombo(date, close_time);
    const now = new Date();

    const courtIds = courtsRes.rows.map((c) => c.id);
    const overlaps = await getOverlaps(courtIds, dayStart, dayEnd);

    const courts = courtsRes.rows.map((court) => {
      const slots = buildSlots(open_time, close_time, court.slot_duration_min, date);
      const courtOverlaps = overlaps.get(court.id) || [];

      return {
        court_id: court.id,
        name: court.name,
        sport: court.sport,
        price_per_slot: court.price_per_slot,
        slot_duration_min: court.slot_duration_min,
        slots: slots.map((slot) => {
          const start = new Date(isoColombo(date, slot.start_time));
          const end = new Date(isoColombo(date, slot.end_time));

          let state = 'available';
          if (end <= now) {
            state = 'past';
          } else if (start > new Date(now.getTime() + advanceDays * 24 * 3600 * 1000)) {
            state = 'outside_window';
          } else {
            for (const overlap of courtOverlaps) {
              if (start < new Date(overlap.end) && end > new Date(overlap.start)) {
                state = overlap.type === 'hold' ? 'held' : overlap.type === 'block' ? 'blocked' : 'booked';
                break;
              }
            }
          }

          return { start_at: start.toISOString(), end_at: end.toISOString(), state };
        })
      };
    });

    ok(res, 200, { date, courts });
  } catch (error) {
    logger.error(`Error fetching availability: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};
