// The QR token is a secret single-use credential (CONTEXT.md: QR Token). It is
// disclosed only to the booking's own player on the booking-detail endpoint —
// never in list payloads, never in realtime events, and never to venue owners
// as an API read (owners only ever receive it by scanning the player's QR).
function stripBookingSecrets(booking) {
  if (!booking) return booking;
  delete booking.qr_token;
  delete booking.idempotency_key;
  return booking;
}

function stripBookingSecretsList(rows) {
  for (const row of rows) stripBookingSecrets(row);
  return rows;
}

module.exports = { stripBookingSecrets, stripBookingSecretsList };