const pool = require('../db');
const { fail } = require('../utils/response');
const logger = require('../utils/logger');
const { bookingBillPdf, registrationBillPdf } = require('../utils/billService');

function sendPdf(res, buffer, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);
  res.status(200).send(buffer);
}

// Player (or admin, or the venue owner) downloads the booking bill PDF.
// A booking whose paid payment was refunded renders with a REFUNDED stamp.
exports.downloadBookingBill = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `select b.id, b.user_id, b.status, v.owner_id as venue_owner_id
       from bookings b join courts c on c.id = b.court_id join venues v on v.id = c.venue_id
       where b.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return fail(res, 404, 'BOOKING_NOT_FOUND', 'Booking not found');
    }
    const booking = rows[0];
    const isSelf = booking.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    const ownsVenue = req.user.role === 'venue_owner' && booking.venue_owner_id === req.user.id;
    if (!isSelf && !isAdmin && !ownsVenue) {
      return fail(res, 403, 'FORBIDDEN', 'Access denied');
    }

    // A cancelled booking whose payment was refunded shows REFUNDED on the bill.
    let statusOverride;
    if (booking.status === 'cancelled') {
      const { rows: paymentRows } = await pool.query(
        `select 1 from payments where booking_id = $1 and status = 'refunded' limit 1`,
        [booking.id]
      );
      if (paymentRows.length > 0) statusOverride = 'REFUNDED';
    }

    const pdf = await bookingBillPdf(booking.id, statusOverride);
    if (!pdf) {
      return fail(res, 404, 'BOOKING_NOT_FOUND', 'Booking not found');
    }
    sendPdf(res, pdf, `spots-bill-${booking.id.slice(0, 8)}.pdf`);
  } catch (error) {
    logger.error(`Error generating booking bill: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

// Player's own registration bill for an event (or admin).
exports.downloadEventRegistrationBill = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `select id, user_id from event_registrations where event_id = $1`,
      [req.params.id]
    );
    const mine = rows.find((r) => r.user_id === req.user.id || req.user.role === 'admin');
    if (!mine) {
      return fail(res, 403, 'FORBIDDEN', 'Access denied');
    }
    const pdf = await registrationBillPdf(mine.id);
    if (!pdf) {
      return fail(res, 404, 'REGISTRATION_NOT_FOUND', 'Registration not found');
    }
    sendPdf(res, pdf, `spots-event-bill-${mine.id.slice(0, 8)}.pdf`);
  } catch (error) {
    logger.error(`Error generating registration bill: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  }
};

module.exports = exports;