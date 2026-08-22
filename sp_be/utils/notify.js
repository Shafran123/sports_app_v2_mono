const emailService = require('./emailService');
const smsService = require('./smsService');
const logger = require('./logger');
const { loadBookingForEvents } = require('./bookingLoader');

// Booking confirmed (online or cash): email + SMS, both fire-and-forget.
async function notifyBookingConfirmed(bookingId) {
  try {
    const booking = await loadBookingForEvents(bookingId);
    if (!booking) return;
    const email = booking.user_email;
    if (email) {
      emailService.notifyBookingConfirmed(booking, email).catch((err) => {
        logger.error(`Booking confirm email failed: ${err.message}`);
      });
    }
    const phone = booking.player_phone || booking.user_phone;
    if (phone) {
      smsService.notifyBookingConfirmed(booking, phone).catch((err) => {
        logger.error(`Booking confirm SMS failed: ${err.message}`);
      });
    }
  } catch (error) {
    logger.error(`Failed to notify booking confirmed ${bookingId}: ${error.message}`);
  }
}

// Admin-initiated cancellation: SMS only (per launch spec).
async function notifyAdminCancellation(bookingId) {
  try {
    const booking = await loadBookingForEvents(bookingId);
    if (!booking) return;
    const phone = booking.player_phone || booking.user_phone;
    if (phone) {
      smsService.notifyCancelledByAdmin(booking, phone).catch((err) => {
        logger.error(`Cancellation SMS failed: ${err.message}`);
      });
    }
  } catch (error) {
    logger.error(`Failed to notify cancellation ${bookingId}: ${error.message}`);
  }
}

module.exports = { notifyBookingConfirmed, notifyAdminCancellation };