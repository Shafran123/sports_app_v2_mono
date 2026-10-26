const crypto = require('crypto');
const { buildCheckoutParams, computeHash } = require('../utils/payhere');

describe('payhere.buildCheckoutParams', () => {
  it('derives return/notify/cancel URLs from the request baseUrl when provided', () => {
    const params = buildCheckoutParams({
      orderId: 'o1',
      amount: 1500,
      firstName: 'A',
      email: 'a@b.c',
      phone: '0700000000',
      city: 'Colombo',
      baseUrl: 'http://localhost:3002'
    });

    expect(params.return_url).toBe('http://localhost:3002');
    expect(params.cancel_url).toBe('http://localhost:3002');
    expect(params.notify_url).toBe('http://localhost:3002/api/v1/payments/payhere/notify');
    expect(params.order_id).toBe('o1');
    expect(params.amount).toBe('1500.00');
  });

  it('falls back to FRONTEND_URL / localhost:3000 when baseUrl is absent', () => {
    const params = buildCheckoutParams({ orderId: 'o2', amount: 100 });
    expect(params.return_url).toBe(process.env.FRONTEND_URL || 'http://localhost:3000');
    expect(params.notify_url).toBe(
      `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/v1/payments/payhere/notify`
    );
  });

  it('still computes the HMAC hash', () => {
    const params = buildCheckoutParams({ orderId: 'o3', amount: 2000 });
    expect(params.hash).toMatch(/^[0-9A-F]{32}$/);
  });

  it('posts the amount in PayHere 2-decimal format (regression: raw "1500" was rejected)', () => {
    const params = buildCheckoutParams({ orderId: 'o4', amount: 1500 });
    expect(params.amount).toBe('1500.00');
  });

  it('hashes the 2-decimal amount, never the raw number (regression)', () => {
    const params = buildCheckoutParams({
      orderId: 'o5',
      amount: 1500,
      merchantId: 'm1',
      merchantSecret: 's1'
    });
    // The pre-fix formula hashed the raw String(amount) — PayHere rejects that.
    const oldFormula = (rawAmount) =>
      crypto
        .createHash('md5')
        .update(
          `m1o5${rawAmount}LKR${crypto
            .createHash('md5')
            .update('s1')
            .digest('hex')
            .toUpperCase()}`
        )
        .digest('hex')
        .toUpperCase();
    expect(params.hash).toBe(oldFormula('1500.00'));
    expect(params.hash).not.toBe(oldFormula('1500'));
  });

  it('floors float drift from tax splitting to the posted 2-decimal amount (regression)', () => {
    const params = buildCheckoutParams({
      orderId: 'o6',
      amount: 1150.0000000000002,
      merchantId: 'm1',
      merchantSecret: 's1'
    });
    expect(params.amount).toBe('1150.00');
    expect(params.hash).toBe(
      computeHash({ merchantId: 'm1', merchantSecret: 's1', orderId: 'o6', amount: '1150.00' })
    );
  });
});