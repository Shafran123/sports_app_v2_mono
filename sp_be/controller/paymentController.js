const crypto = require('crypto');
const pool = require('../db');
const { ok, fail } = require('../utils/response');
const logger = require('../utils/logger');
const { mintQrToken } = require('../utils/tokens');
const { publishBookingEvent } = require('../utils/publish');
const notificationCatalog = require('../utils/notificationCatalog');
const billService = require('../utils/billService');

// Fail-closed: config/env.js guarantees these exist outside NODE_ENV=test.
const MERCHANT_ID = process.env.PAYHERE_MERCHANT_ID;
const MERCHANT_SECRET = process.env.PAYHERE_MERCHANT_SECRET;

function verifySignature(body) {
  const secretMd5 = crypto
    .createHash('md5')
    .update(MERCHANT_SECRET)
    .digest('hex')
    .toUpperCase();
  const expected = crypto
    .createHash('md5')
    .update(
      `${body.merchant_id}${body.order_id}${body.payhere_amount}${body.payhere_currency}${body.status_code}${secretMd5}`
    )
    .digest('hex')
    .toUpperCase();
  return body.merchant_id === MERCHANT_ID && body.md5sig === expected;
}

exports.handleNotify = async (req, res) => {
  const client = await pool.connect();
  try {
    const body = req.body;

    if (!verifySignature(body)) {
      logger.error('PayHere webhook rejected: invalid signature');
      return fail(res, 400, 'INVALID_SIGNATURE', 'Invalid signature');
    }

    const { order_id, status_code } = body;

    await client.query('begin');

    const { rows: paymentRows } = await client.query(
      `select * from payments where payhere_payment_id = $1 for update`,
      [order_id]
    );
    if (paymentRows.length === 0) {
      await client.query('rollback');
      logger.warn(`PayHere webhook for unknown order ${order_id}`);
      return fail(res, 404, 'PAYMENT_NOT_FOUND', 'Payment not found');
    }

    const payment = paymentRows[0];

    if (payment.status === 'paid' || payment.status === 'refunded') {
      await client.query('rollback');
      return ok(res, 200, { handled: true, status: payment.status });
    }

    if (payment.event_registration_id) {
      if (status_code === '2') {
        await client.query(
          `update event_registrations set status = 'paid' where id = $1`,
          [payment.event_registration_id]
        );
        await client.query(
          `update payments set status = 'paid', paid_at = now() where id = $1`,
          [payment.id]
        );
        await client.query('commit');
        await notificationCatalog.dispatchEventRegistration('event.registered', payment.event_registration_id);
        void billService.emailBillForRegistration(payment.event_registration_id);
        return ok(res, 200, { handled: true, event_registration_id: payment.event_registration_id });
      }
      await client.query(
        `update event_registrations set status = 'cancelled' where id = $1`,
        [payment.event_registration_id]
      );
      await client.query(
        `update payments set status = 'failed' where id = $1`,
        [payment.id]
      );
      await client.query('commit');
      return ok(res, 200, { handled: true, event_registration_id: payment.event_registration_id, status: 'failed' });
    }

    if (status_code === '2') {
      const { rows: holdRows } = await client.query(
        `select * from holds where id = $1`,
        [order_id]
      );

      if (holdRows.length === 0) {
        await client.query(
          `update payments set status = 'failed', needs_manual_refund = true where id = $1`,
          [payment.id]
        );
        await client.query('commit');
        logger.error(`PayHere success for ${order_id} but hold missing — manual refund needed`);
        return ok(res, 200, { handled: true, needs_manual_refund: true });
      }

      const hold = holdRows[0];

      const { rows: courtRows } = await client.query(
        `select c.price_per_slot, u.name as player_name, coalesce(h.player_phone, u.phone) as player_phone
         from courts c
         join holds h on h.id = $2
         join users u on u.id = h.user_id
         where c.id = $1`,
        [hold.court_id, hold.id]
      );
      const pricePerSlot = courtRows.length ? courtRows[0].price_per_slot : payment.amount;
      const playerName = courtRows.length ? courtRows[0].player_name : null;
      const playerPhone = courtRows.length ? courtRows[0].player_phone : null;

      let conflict = false;
      let booking;
      try {
        await client.query('savepoint booking_insert');
        const inserted = await client.query(
          `insert into bookings (court_id, user_id, start_at, end_at, price_per_slot, total_price, tax_rate, tax_amount, venue_tax_rate, venue_tax_amount, status, payment_method, player_name, player_phone, qr_token, idempotency_key)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'confirmed', 'online', $11, $12, $13, $14)
           returning *`,
          [hold.court_id, hold.user_id, hold.start_at, hold.end_at, pricePerSlot, payment.amount, payment.tax_rate, payment.tax_amount, payment.venue_tax_rate, payment.venue_tax_amount, playerName, playerPhone, mintQrToken(), hold.idempotency_key]
        );
        booking = inserted.rows[0];
      } catch (error) {
        await client.query('rollback to savepoint booking_insert');
        if (error.code === '23505' || error.code === '23P01') {
          conflict = true;
        } else {
          throw error;
        }
      }

      if (conflict) {
        const { rows: existing } = await client.query(
          `select id from bookings where idempotency_key = $1`,
          [hold.idempotency_key]
        );
        if (existing.length > 0) {
          booking = existing[0];
        } else {
          await client.query(
            `update payments set status = 'failed', needs_manual_refund = true where id = $1`,
            [payment.id]
          );
          await client.query(`delete from holds where id = $1`, [hold.id]);
          await client.query('commit');
          logger.error(
            `PayHere success for ${order_id} but slot was taken by another booking — manual refund needed`
          );
          return ok(res, 200, { handled: true, needs_manual_refund: true });
        }
      }

      await client.query(
        `update payments set status = 'paid', paid_at = now(), needs_manual_refund = false, booking_id = $2 where id = $1`,
        [payment.id, booking.id]
      );
      await client.query(`delete from holds where id = $1`, [hold.id]);

      await client.query('commit');

      await publishBookingEvent('booking.created', booking.id);
      await notificationCatalog.dispatchBooking('booking.confirmed', booking.id);
      void billService.emailBillForBooking(booking.id);

      return ok(res, 200, { handled: true, booking_id: booking.id });
    }

    await client.query(
      `update payments set status = 'failed' where id = $1`,
      [payment.id]
    );
    await client.query(`delete from holds where id = $1`, [order_id]);
    await client.query('commit');

    ok(res, 200, { handled: true, status: 'failed' });
  } catch (error) {
    await client.query('rollback').catch(() => {});
    logger.error(`PayHere webhook error: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  } finally {
    client.release();
  }
};

exports.adminRefund = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query('begin');

    const { rows: paymentRows } = await client.query(
      `select * from payments where id = $1 for update`,
      [id]
    );
    if (paymentRows.length === 0) {
      await client.query('rollback');
      return fail(res, 404, 'PAYMENT_NOT_FOUND', 'Payment not found');
    }
    const payment = paymentRows[0];

    if (payment.status === 'refunded') {
      await client.query('rollback');
      return fail(res, 409, 'ALREADY_REFUNDED', 'This payment has already been refunded');
    }
    if (payment.status !== 'paid') {
      await client.query('rollback');
      return fail(res, 409, 'PAYMENT_NOT_REFUNDABLE', 'Only paid payments can be refunded');
    }

    const authorization = process.env.PAYHERE_AUTHORIZATION;
    if (!authorization) {
      await client.query('rollback');
      return fail(res, 503, 'REFUND_GATEWAY_NOT_CONFIGURED', 'PayHere refund credentials are not configured');
    }

    const axios = require('axios');
    const refundUrl = process.env.PAYHERE_REFUND_URL || 'https://sandbox.payhere.lk/merchant/v1.0/refund';
    try {
      await axios.post(
        refundUrl,
        { order_id: payment.payhere_payment_id, amount: String(payment.amount) },
        { headers: { Authorization: `Bearer ${authorization}` } }
      );
    } catch (error) {
      await client.query('rollback');
      logger.error(`PayHere refund gateway error: ${error.message}`);
      return fail(res, 502, 'REFUND_GATEWAY_ERROR', 'The payment gateway rejected the refund');
    }

    await client.query(
      `update payments set status = 'refunded', refunded_at = now() where id = $1`,
      [payment.id]
    );

    if (payment.booking_id) {
      await client.query(
        `update bookings set status = 'cancelled', cancelled_at = now(), updated_at = now() where id = $1`,
        [payment.booking_id]
      );
    }

    await client.query('commit');

    if (payment.booking_id) {
      await publishBookingEvent('booking.cancelled', payment.booking_id);
      await notificationCatalog.dispatchBooking('booking.cancelled.admin', payment.booking_id);
    }

    ok(res, 200, { id: payment.id, status: 'refunded' });
  } catch (error) {
    await client.query('rollback').catch(() => {});
    logger.error(`Error refunding payment: ${error.message}`);
    fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
  } finally {
    client.release();
  }
};
