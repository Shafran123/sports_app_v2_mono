const pool = require('../db');
const logger = require('../utils/logger');
const cancellationService = require('../services/cancellation');
const { publishBookingEvent } = require('../utils/publish');
const notificationCatalog = require('../utils/notificationCatalog');

const INTERVAL_MINUTES = 15;

// Pending Auto-cancel (ADR-0040): a booking still `pending` N hours before
// its start (N = the Business's pending_auto_cancel_hours) is auto-cancelled,
// freeing its slot. An online-paid pending booking is refunded in full (no
// service was rendered). Idempotent: only rows still `pending` are touched.
async function runAutoCancelJob() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `select b.id
       from bookings b
       join courts c on c.id = b.court_id
       join venues v on v.id = c.venue_id
       join businesses biz on biz.id = v.business_id
       where b.status = 'pending'
         and b.start_at - (biz.pending_auto_cancel_hours || ' hours')::interval <= now()
       limit 100`
    );

    for (const row of rows) {
      try {
        await client.query('begin');
        const result = await cancellationService.cancelBooking(client, row.id, null, 'system', null, 'auto');
        if (result.error) {
          await client.query('rollback');
          logger.warn(`Auto-cancel skipped booking ${row.id}: ${result.error.message}`);
          continue;
        }
        await client.query('commit');
        await publishBookingEvent('booking.cancelled', row.id);
        await notificationCatalog.dispatchBooking('booking.cancelled.player', row.id, {
          refund: { refund_amount: result.refund_amount, refund_pct: result.refund_pct }
        });
      } catch (err) {
        await client.query('rollback').catch(() => {});
        logger.error(`Auto-cancel failed for booking ${row.id}: ${err.message}`);
      }
    }
  } catch (error) {
    logger.error(`Auto-cancel job error: ${error.message}`);
  } finally {
    client.release();
  }
}

function startAutoCancelJob() {
  setInterval(runAutoCancelJob, INTERVAL_MINUTES * 60 * 1000);
  runAutoCancelJob();
}

module.exports = { startAutoCancelJob, runAutoCancelJob };