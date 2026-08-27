const pool = require('../db');
const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');
const { isoColombo } = require('../utils/colombo');
const { windowsForDay, effectiveAdvanceDays, slotsForWindows } = require('../services/venueEngine');
const { slotPricing } = require('../services/pricingEngine');

async function getOverlaps(courtIds, dayStart, dayEnd) {
  const [bookings, holds, blocks] = await Promise.all([
    pool.query(
      `select court_id, start_at, end_at from bookings
       where court_id = any($1)
         and status in ('pending', 'confirmed', 'completed', 'no_show')
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

    const windows = await windowsForDay(pool, id, date);
    const advanceDays = await effectiveAdvanceDays(pool, id);

    // Best active venue-wide offer for the requested date, so the player can
    // see the promotion before checkout. Venue-wide offers apply to the whole
    // booking at checkout; this only drives the pre-checkout badge.
    const venueOffer = await activeVenueOffer(pool, id, date);

    if (windows.length === 0) {
      return ok(res, 200, { date, advance_days: advanceDays, venue_offer: venueOffer, courts: [] });
    }

    const dayStart = isoColombo(date, windows[0].open_time);
    const dayEnd = isoColombo(date, windows[windows.length - 1].close_time);
    const now = new Date();

    const { rows: courtsRes } = await pool.query(
      `select c.id, c.venue_id, c.name, c.price_per_slot, c.slot_duration_min, s.name as sport
       from courts c left join sports s on s.id = c.sport_id
       where c.venue_id = $1 and c.is_active
       order by c.name`,
      [id]
    );

    const courtIds = courtsRes.map((c) => c.id);
    const overlaps = await getOverlaps(courtIds, dayStart, dayEnd);

    const courts = [];
    for (const court of courtsRes) {
      const rawSlots = slotsForWindows(windows, court.slot_duration_min);
      const courtOverlaps = overlaps.get(court.id) || [];

      const slots = [];
      for (const raw of rawSlots) {
        const start = new Date(isoColombo(date, raw.start_time));
        const end = new Date(isoColombo(date, raw.end_time));

        let state = 'available';
        if (end <= now) {
          state = 'past';
        } else if (advanceDays > 0 && start > new Date(now.getTime() + advanceDays * 24 * 3600 * 1000)) {
          state = 'outside_window';
        } else {
          for (const overlap of courtOverlaps) {
            if (start < new Date(overlap.end) && end > new Date(overlap.start)) {
              state = overlap.type === 'hold' ? 'held' : overlap.type === 'block' ? 'blocked' : 'booked';
              break;
            }
          }
        }

        const pricing = await slotPricing(pool, court, date, raw.start_time);
        slots.push({
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          state,
          price: pricing.base_price,
          offer_price: pricing.offer_price
        });
      }

      courts.push({
        court_id: court.id,
        name: court.name,
        sport: court.sport,
        price_per_slot: court.price_per_slot,
        slot_duration_min: court.slot_duration_min,
        slots
      });
    }

    ok(res, 200, { date, advance_days: advanceDays, venue_offer: venueOffer, courts });
  } catch (error) {
    logger.error(`Error fetching availability: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

// Best venue-wide offer active for the venue on `dateStr`, or null. The best
// (largest discount on a Rs 100 base) is returned for the header badge.
async function activeVenueOffer(client, venueId, dateStr) {
  const { rows } = await client.query(
    `select discount_type, percent, flat_amount
     from offers
     where venue_id = $1 and kind = 'venue' and is_active = true
       and (start_date is null or start_date <= $2::date)
       and (end_date is null or end_date >= $2::date)`,
    [venueId, dateStr]
  );
  let best = null;
  let bestScore = -1;
  for (const row of rows) {
    const score = row.discount_type === 'percent'
      ? Number(row.percent) || 0
      : (Number(row.flat_amount) || 0) / 100;
    if (score > bestScore) {
      bestScore = score;
      best = {
        discount_type: row.discount_type,
        value: row.discount_type === 'percent' ? Number(row.percent) || 0 : Number(row.flat_amount) || 0
      };
    }
  }
  return best;
}