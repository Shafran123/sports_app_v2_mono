const crypto = require('crypto');

// Fail-closed: config/env.js guarantees these exist outside NODE_ENV=test.
const MERCHANT_ID = process.env.PAYHERE_MERCHANT_ID;
const MERCHANT_SECRET = process.env.PAYHERE_MERCHANT_SECRET;
const CHECKOUT_URL = process.env.PAYHERE_CHECKOUT_URL || 'https://sandbox.payhere.lk/pay/checkout';

function buildCheckoutParams({ orderId, amount, firstName, email, phone, city, baseUrl }) {
  const base = baseUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
  // The notify URL is hit by PayHere's servers, so it must address the API.
  // API_PUBLIC_URL overrides when the API origin differs from FRONTEND_URL.
  const notify = process.env.PAYHERE_NOTIFY_URL || `${process.env.API_PUBLIC_URL || base}/api/v1/payments/payhere/notify`;
  const hash = crypto
    .createHash('md5')
    .update(`${MERCHANT_ID}${orderId}${amount}LKR${crypto.createHash('md5').update(MERCHANT_SECRET).digest('hex').toUpperCase()}`)
    .digest('hex')
    .toUpperCase();

  return {
    checkout_url: CHECKOUT_URL,
    merchant_id: MERCHANT_ID,
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
    return_url: base,
    cancel_url: base,
    hash
  };
}

module.exports = { buildCheckoutParams };
