// Colombo (+05:30, no DST) local-time helpers shared by the availability and
// booking engines so both sides agree on which day and wall-clock time a slot
// falls on. Sri Lanka has no DST, so the shift is a constant half-hour offset.

// Weekday index (0 = Sunday) of the LOCAL date the string falls on. Noon local
// keeps the UTC date identical to the local date (local midnight would land on
// the previous UTC day for +05:30).
function dayOfWeekOf(dateStr) {
  return new Date(`${dateStr}T12:00:00+05:30`).getUTCDay();
}

// Build a full instant (UTC ISO string) from a local date + "HH:MM" wall time.
function isoColombo(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00+05:30`;
}

// Convert an instant (UTC or offset ISO string) to its Colombo wall-clock
// instant: the same ISO string with +05:30 added. The returned string's date
// and HH:MM are what a clock in Colombo would show.
function colomboLocal(dateStr) {
  const d = new Date(dateStr);
  return new Date(d.getTime() + (5 * 60 + 30) * 60 * 1000).toISOString();
}

// "HH:MM" wall-clock time in Colombo for an instant.
function colomboTime(dateStr) {
  return colomboLocal(dateStr).slice(11, 16);
}

// "YYYY-MM-DD" local date in Colombo for an instant.
function colomboDate(dateStr) {
  return colomboLocal(dateStr).slice(0, 10);
}

// "HH:MM" → minutes since midnight.
function toMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// minutes since midnight → "HH:MM".
function fromMinutes(min) {
  const m = ((Math.round(min) % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

module.exports = { dayOfWeekOf, isoColombo, colomboLocal, colomboTime, colomboDate, toMinutes, fromMinutes };