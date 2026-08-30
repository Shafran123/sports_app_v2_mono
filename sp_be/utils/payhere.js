const crypto = require('crypto');

// Fail-closed: config/env.js guarantees these exist outside NODE_ENV=test.
// They are the PLATFORM gateway — used only for events and legacy payments
// (ADR-0044). Every new booking's checkout params carry the Business's own
// merchant credentials instead.
const MERCHANT_ID = process.env.PAYHERE_MERCHANT_ID;
const MERCHANT_SECRET = process.env.PAYHERE_MERCHANT_SECRET;
const CHECKOUT_URL = process.env.PAYHERE_CHECKOUT_URL || 'https://sandbox.payhere.lk/pay/checkout';

// The PayHere hash is upper(md5(merchant_id + order_id + amount + currency +
// upper(md5(merchant_secret)))) — computed with the credentials the payment
// runs on, never a global.
function computeHash({ merchantId, merchantSecret, orderId, amount, currency = 'LKR' }) {
  return crypto
    .createHash('md5')
    .update(
      `${merchantId}${orderId}${amount}${currency}${crypto
        .createHash('md5')
        .update(merchantSecret)
        .digest('hex')
        .toUpperCase()}`
    )
    .digest('hex')
    .toUpperCase();
}

// merchantId/merchantSecret are optional: when omitted the platform gateway's
// env credentials are used (events/legacy). Every booking flow passes the
// resolved Business credentials.
function buildCheckoutParams({ orderId, amount, firstName, email, phone, city, baseUrl, merchantId, merchantSecret, returnUrl }) {
  const base = baseUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
  // The notify URL is hit by PayHere's servers, so it must address the API.
  // API_PUBLIC_URL overrides when the API origin differs from FRONTEND_URL.
  const notify = process.env.PAYHERE_NOTIFY_URL || `${process.env.API_PUBLIC_URL || base}/api/v1/payments/payhere/notify`;
  const id = merchantId || MERCHANT_ID;
  const secret = merchantSecret || MERCHANT_SECRET;

  return {
    checkout_url: CHECKOUT_URL,
    merchant_id: id,
    order_id: orderId,
    items: 'Court booking',
    currency: 'LKR',
    amount: String(amount),
    first_name: firstName || '',
    email: email || '',
    phone: phone || '',
    city: city || '',
    country: 'Sri Lanka',
    notify_url: notify,
    // returnUrl overrides for surface-appropriate returns — the Booking
    // Widget returns to its own embed so the iframe lands back in the flow.
    return_url: returnUrl || base,
    cancel_url: returnUrl || base,
    hash: computeHash({ merchantId: id, merchantSecret: secret, orderId, amount, currency: 'LKR' })
  };
}

// The PayHere IPN signature (md5sig) is upper(md5(merchant_id + order_id +
// payhere_amount + payhere_currency + status_code + upper(md5(secret)))) —
// the status_code is part of the hash, unlike the checkout hash.
function computeNotifySig({ merchantId, merchantSecret, orderId, amount, currency, statusCode }) {
  return crypto
    .createHash('md5')
    .update(
      `${merchantId}${orderId}${amount}${currency}${statusCode}${crypto
        .createHash('md5')
        .update(merchantSecret)
        .digest('hex')
        .toUpperCase()}`
    )
    .digest('hex')
    .toUpperCase();
}

module.exports = { buildCheckoutParams, computeHash, computeNotifySig };