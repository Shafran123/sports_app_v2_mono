// Venue calendar engine: which Opening Windows exist on a given day, whether
// the venue is closed that day, and how far ahead it accepts bookings.
//
// This is the single seam the availability controller and the booking/checkout
// path both consult, so a slot is never bookable on one side but hidden on the
// other. Windows are read fresh per request (no caching) so owner edits apply
// immediately.

const { dayOfWeekOf } = require('../utils/colombo');

// Opening Windows ignoring Closed Dates — used when validating a pricing/offer
// window at save time (a Closed Date must not block an owner from configuring a
// window that applies on other days).
async function rawWindowsForDay(client, venueId, dateStr) {
  const dow = dayOfWeekOf(dateStr);
  const { rows } = await client.query(
    `select open_time, close_time
     from venue_hours
     where venue_id = $1 and day_of_week = $2
     order by open_time`,
    [venueId, dow]
  );
  return rows.map((r) => ({
    open_time: r.open_time.slice(0, 5),
    close_time: r.close_time.slice(0, 5)
  }));
}

// Opening Windows for a venue on a local date, or [] when the venue is closed
// that day (no hours rows, or the date is a Closed Date). Each window is a
// { open_time, close_time } pair in "HH:MM".
async function windowsForDay(client, venueId, dateStr) {
  const rows = await rawWindowsForDay(client, venueId, dateStr);
  if (rows.length === 0) return [];

  const { rows: closed } = await client.query(
    `select 1 from venue_closed_dates where venue_id = $1 and closed_date = $2`,
    [venueId, dateStr]
  );
  if (closed.length > 0) return [];

  return rows;
}

async function isClosedDate(client, venueId, dateStr) {
  const { rows } = await client.query(
    `select 1 from venue_closed_dates where venue_id = $1 and closed_date = $2`,
    [venueId, dateStr]
  );
  return rows.length > 0;
}

// Effective advance-booking horizon for a venue in days. 0 = unlimited (the
// venue accepts bookings as far ahead as it chooses). A positive value caps
// the booking window at that many days from today.
async function effectiveAdvanceDays(client, venueId) {
  const { rows } = await client.query(
    `select advance_days from venues where id = $1`,
    [venueId]
  );
  if (rows.length === 0) return 0;
  const days = Number(rows[0].advance_days);
  return Number.isFinite(days) && days > 0 ? days : 0;
}

// Slots inside one window: [{ start_time, end_time }] every durationMin,
// aligned so a slot never straddles the window boundary.
function slotsInWindow(openTime, closeTime, durationMin) {
  const [openH, openM] = openTime.split(':').map(Number);
  const [closeH, closeM] = closeTime.split(':').map(Number);
  const open = openH * 60 + openM;
  const close = closeH * 60 + closeM;
  const dur = Number(durationMin);

  const slots = [];
  for (let t = open; t + dur <= close; t += dur) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    const start = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const endT = t + dur;
    const eh = Math.floor(endT / 60);
    const em = endT % 60;
    const end = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
    slots.push({ start_time: start, end_time: end });
  }
  return slots;
}

// Slots across every window of a day, in window order. Gaps between windows
// produce no slots — a booking can never straddle a gap.
function slotsForWindows(windows, durationMin) {
  const slots = [];
  for (const win of windows) {
    slots.push(...slotsInWindow(win.open_time, win.close_time, durationMin));
  }
  return slots;
}

module.exports = { windowsForDay, rawWindowsForDay, isClosedDate, effectiveAdvanceDays, slotsInWindow, slotsForWindows };