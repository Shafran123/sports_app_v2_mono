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

// Cancel a booking inside the caller's transaction. `actor` names who is
// cancelling: 'user' (player/site customer self-cancel), 'owner', 'admin',
// or 'auto' (the Pending Auto-cancel timer).
//
// Refund policy (ADR-0038/0040): a *pending* booking has had no service
// rendered, so it always refunds 100% regardless of tier — cancelling it
// (by any actor, including the timer) returns the full amount. A *confirmed*
// booking refunds per the platform cancellation tiers. Only the player's own
// cancel is bound by the venue Cancel Cutoff.
async function cancelBooking(client, bookingId, actorUserId, actorRole, siteCustomerId, actor = 'user') {
  const { rows } = await client.query(
    `select * from bookings where id = $1 for update`,
    [bookingId]
  );
  if (rows.length === 0) {
    return { error: { status: 404, code: 'BOOKING_NOT_FOUND', message: 'Booking not found' } };
  }
  const booking = rows[0];

  const isOwnerActor =
    actorRole === 'venue_owner' || actorRole === 'admin' || actor === 'auto';

  // A Site Customer may cancel the bookings under their own per-Business
  // account (site_customer_id), just like a Player cancels their own.
  if (!isOwnerActor && booking.user_id !== actorUserId && booking.site_customer_id !== siteCustomerId) {
    return { error: { status: 403, code: 'FORBIDDEN', message: 'You cannot cancel this booking' } };
  }

  if (!['pending', 'confirmed'].includes(booking.status)) {
    return { error: { status: 409, code: 'BOOKING_NOT_CANCELLABLE', message: 'This booking cannot be cancelled' } };
  }

  const now = new Date();
  const hoursBefore = (new Date(booking.start_at) - now) / 3600000;

  // Cancel Cutoff (per venue): a confirmed booking self-cancels only while the
  // start is at least the venue's cutoff away. Pending bookings self-cancel
  // freely (no service was confirmed), and owners/admins/timer are never bound.
  if (actor === 'user' && !isOwnerActor && booking.status === 'confirmed') {
    const { rows: venueRows } = await client.query(
      `select cancel_cutoff_hours from venues where id = $1`,
      [booking.venue_id]
    );
    const cancelCutoffHours = venueRows[0]?.cancel_cutoff_hours ?? 2;
    if (hoursBefore < cancelCutoffHours) {
      return {
        error: {
          status: 409,
          code: 'CANCEL_CUTOFF',
          message: `Bookings can be self-cancelled up to ${cancelCutoffHours} hour${cancelCutoffHours === 1 ? '' : 's'} before the start. Please contact the venue.`
        }
      };
    }
  }

  // A pending booking always refunds in full (nothing was delivered yet).
  const refundPct = booking.status === 'pending' ? 100 : computeRefundPct(await getTiers(), hoursBefore);
  const refundAmount = Math.round((booking.total_price * refundPct) / 100);
  // The canceller (ADR-0038): the explicit actor wins; otherwise derive it from
  // the caller's role — an owner or admin cancelling (even via the player
  // route) is recorded as such, never as a player cancel.
  const cancelStatus =
    actor === 'auto'
      ? 'cancelled_auto'
      : actor === 'admin' || (actorRole === 'admin' && actor !== 'owner')
        ? 'cancelled_by_admin'
        : actor === 'owner' || actorRole === 'venue_owner'
          ? 'cancelled_by_owner'
          : 'cancelled_by_user';

  await client.query(
    `update bookings set status = $2, cancelled_at = now(), updated_at = now() where id = $1`,
    [bookingId, cancelStatus]
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

  return { ...booking, status: cancelStatus, refund_amount: refundAmount, refund_pct: refundPct, hours_before: hoursBefore };
}

module.exports = { computeRefundPct, cancelBooking, getTiers };