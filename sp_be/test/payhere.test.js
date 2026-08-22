const { buildCheckoutParams } = require('../utils/payhere');

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
    expect(params.amount).toBe('1500');
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
});