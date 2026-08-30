// PayHere refunds for per-Business payments (ADR-0044, ticket 08): the money
// lives in the owner's account, so the refund goes through the Business's own
// app_id/app_secret (OAuth client-credentials → Bearer token), never the
// platform's. Platform-scoped payments (events + legacy) keep the admin
// refund path. Fire-and-forget from cancellation: a failed refund sets
// needs_manual_refund for the admin to chase.

const axios = require('axios');
const pool = require('../db');
const logger = require('../utils/logger');
const { resolvePayhereCredentials, businessAccessToken } = require('./businessPaymentMethods');

const REFUND_URL =
  process.env.PAYHERE_REFUND_URL || 'https://sandbox.payhere.lk/merchant/v1.0/refund';

// Refund a paid payment through the credentials that minted it. Returns
// { refunded: true } on success; on failure { refunded: false, error } with
// needs_manual_refund set so an admin can chase it. `client` (an open
// transaction) is optional: when passed, the status flip commits atomically
// with the caller's transaction (admin refund).
async function refundPayherePayment(payment, client = pool) {
  if (payment.status !== 'paid' || payment.payment_method !== 'payhere' || !payment.payhere_payment_id) {
    return { refunded: false, error: 'not a refundable payhere payment' };
  }

  // Platform scope (gateway_business_id null): events + legacy payments —
  // refund stays a manual/admin action, never auto-fired with business creds.
  if (!payment.gateway_business_id) {
    await client.query(
      `update payments set needs_manual_refund = true where id = $1`,
      [payment.id]
    );
    return { refunded: false, error: 'platform-scoped payment — manual refund required' };
  }

  try {
    const creds = await resolvePayhereCredentials(payment.gateway_business_id);
    if (!creds) {
      await client.query(
        `update payments set needs_manual_refund = true where id = $1`,
        [payment.id]
      );
      return { refunded: false, error: 'business payhere credentials unavailable' };
    }
    const token = await businessAccessToken(creds.appId, creds.appSecret);
    await axios.post(
      REFUND_URL,
      { order_id: payment.payhere_payment_id, amount: String(payment.amount) },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    await client.query(
      `update payments set status = 'refunded', refunded_at = now() where id = $1 and status = 'paid'`,
      [payment.id]
    );
    return { refunded: true };
  } catch (error) {
    logger.error(`PayHere business refund failed for payment ${payment.id}: ${error.message}`);
    await client.query(
      `update payments set needs_manual_refund = true where id = $1`,
      [payment.id]
    );
    return { refunded: false, error: error.message };
  }
}

module.exports = { refundPayherePayment };