const logger = require('./logger');
const { realtime } = require('../realtime');
const { loadBookingForEvents } = require('./bookingLoader');

// Resolve a booking's owner and push a live event to that owner's room.
// Fire-and-forget: a missing room or an unstarted socket server is a no-op.
async function publishBookingEvent(event, bookingId) {
  try {
    const booking = await loadBookingForEvents(bookingId);
    if (!booking) {
      return;
    }
    realtime.emitToOwner(booking.venue_owner_id, event, booking);
  } catch (error) {
    logger.error(`Failed to publish ${event} for booking ${bookingId}: ${error.message}`);
  }
}

module.exports = { publishBookingEvent };