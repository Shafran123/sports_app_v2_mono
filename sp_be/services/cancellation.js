const pool = require('../db');
const logger = require('../utils/logger');

async function getTiers() {
  const { rows } = await pool.query(
    `select value from platform_config where key = 'cancellation_tiers'`
  );
  if (rows.length === 0) {
    return [{ hours: 24, refund_pct: 100 }, { hours: 12, refund_pct: 50 }, { hours: 0, refund_pct: 0 }];
  }
  return rows[0].value.sort((a, b) => b.hours - a.hours);
}

function computeRefundPct(tiers, hoursBefore) {
  for (const tier of tiers) {
    if (hoursBefore >= tier.hours) {
      return tier.refund_pct;
    }
  }
  return 0;
}

async function cancelBooking(client, bookingId, actorUserId, actorRole, siteCustomerId) {
  const { rows } = await client.query(
    `select * from bookings where id = $1 for update`,
    [bookingId]
  );
  if (rows.length === 0) {
    return { error: { status: 404, code: 'BOOKING_NOT_FOUND', message: 'Booking not found' } };
  }
  const booking = rows[0];

  const isOwnerActor =
    actorRole === 'venue_owner' || actorRole === 'admin';

  // A Site Customer may cancel the bookings under their own per-Business
  // account (site_customer_id), just like a Player cancels their own.
  if (!isOwnerActor && booking.user_id !== actorUserId && booking.site_customer_id !== siteCustomerId) {
    return { error: { status: 403, code: 'FORBIDDEN', message: 'You cannot cancel this booking' } };
  }

  if (booking.status !== 'confirmed') {
    return { error: { status: 409, code: 'BOOKING_NOT_CANCELLABLE', message: 'This booking cannot be cancelled' } };
  }

  const now = new Date();
  const hoursBefore = (new Date(booking.start_at) - now) / 3600000;

  // Cancel Cutoff (per venue): players self-cancel only while the booking
  // start is at least the venue's cutoff away. Venue owners and admins are
  // not bound by it — they cancel for operational reasons.
  const { rows: venueRows } = await client.query(
    `select cancel_cutoff_hours from venues where id = $1`,
    [booking.venue_id]
  );
  const cancelCutoffHours = venueRows[0]?.cancel_cutoff_hours ?? 2;
  if (!isOwnerActor && hoursBefore < cancelCutoffHours) {
    return {
      error: {
        status: 409,
        code: 'CANCEL_CUTOFF',
        message: `Bookings can be self-cancelled up to ${cancelCutoffHours} hour${cancelCutoffHours === 1 ? '' : 's'} before the start. Please contact the venue.`
      }
    };
  }

  const tiers = await getTiers();
  const refundPct = computeRefundPct(tiers, hoursBefore);
  const refundAmount = Math.round((booking.total_price * refundPct) / 100);

  await client.query(
    `update bookings set status = 'cancelled', cancelled_at = now(), updated_at = now() where id = $1`,
    [bookingId]
  );

  if (refundAmount > 0) {
    const { rows: paymentRows } = await client.query(
      `select * from payments where booking_id = $1 and status = 'paid' limit 1`,
      [bookingId]
    );
    if (paymentRows.length > 0 && paymentRows[0].payment_method === 'online') {
      await client.query(
        `update payments set needs_manual_refund = true where id = $1`,
        [paymentRows[0].id]
      );
    }
  }

  return { ...booking, status: 'cancelled', refund_amount: refundAmount, refund_pct: refundPct, hours_before: hoursBefore };
}

module.exports = { computeRefundPct, cancelBooking, getTiers };
