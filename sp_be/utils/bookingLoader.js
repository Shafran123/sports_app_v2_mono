const pool = require('../db');

// One booking row loaded with the derived fields the realtime + notification
// wiring needs: the owning venue's owner id, the player's contact details,
// and the venue's operator contact for the branded email section.
// The secret QR token and idempotency key are NEVER included in these payloads
// (CONTEXT.md: QR Token is disclosed only to the booking's own player).
const BOOKING_EVENTS_SELECT = `
  select b.id, b.court_id, b.user_id, b.start_at, b.end_at, b.status,
         b.payment_method, b.total_price, b.player_name, b.player_phone,
         c.name as court_name, v.name as venue_name,
         v.address as venue_address, v.city as venue_city, v.phone as venue_phone,
         v.owner_id as venue_owner_id,
         u.email as user_email, u.phone as user_phone,
         o.email as owner_email, o.phone as owner_phone
  from bookings b
  join courts c on c.id = b.court_id
  join venues v on v.id = c.venue_id
  left join users u on u.id = b.user_id
  left join users o on o.id = v.owner_id
  where b.id = $1`;

async function loadBookingForEvents(bookingId) {
  const { rows } = await pool.query(BOOKING_EVENTS_SELECT, [bookingId]);
  return rows[0] || null;
}

// Dedicated QR-token load used ONLY by the player-facing email builders.
// Kept out of the shared booking payload so the secret never fans out to
// owner/admin recipients. The caller must assert the recipient is the player.
async function loadQrToken(bookingId) {
  const { rows } = await pool.query(`select qr_token from bookings where id = $1`, [bookingId]);
  return rows[0]?.qr_token || null;
}

module.exports = { loadBookingForEvents, loadQrToken };