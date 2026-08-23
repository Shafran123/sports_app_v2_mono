const { applyInclusiveTax } = require('../utils/featureFlags');

// ADR-0021: inclusive pricing. The listed price IS the total the player pays;
// platform + venue tax are carved out of it. base + platformTax + venueTax
// must always equal total (integer LKR, half-up rounding).
describe('inclusive tax split', () => {
  it('carves platform tax and venue tax out of a listed total', () => {
    const r = applyInclusiveTax(1000, 5, 10);
    expect(r.total).toBe(1000);
    expect(r.base).toBe(850);
    expect(r.platformTax).toBe(50);
    expect(r.venueTax).toBe(100);
  });

  it('matches the owners reading: 100 total with 10% venue tax -> 90 kept, 10 to tax', () => {
    const r = applyInclusiveTax(100, 0, 10);
    expect(r.base).toBe(90);
    expect(r.venueTax).toBe(10);
    expect(r.platformTax).toBe(0);
  });

  it('with only platform tax, the venue share of the total is base + venue tax', () => {
    const r = applyInclusiveTax(100, 10, 0);
    expect(r.base).toBe(90);
    expect(r.platformTax).toBe(10);
    expect(r.venueTax).toBe(0);
  });

  it('base + platformTax + venueTax always exactly equals total, and never goes negative', () => {
    for (const total of [99, 100, 101, 1000, 12345]) {
      for (const pr of [0, 5, 12, 50, 100]) {
        for (const vr of [0, 3, 10, 25, 100]) {
          const r = applyInclusiveTax(total, pr, vr);
          expect(r.base + r.platformTax + r.venueTax).toBe(total);
          expect(r.base).toBeGreaterThanOrEqual(0);
          expect(r.platformTax).toBeGreaterThanOrEqual(0);
          expect(r.venueTax).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('zero rates leave the total intact', () => {
    expect(applyInclusiveTax(1500, 0, 0)).toEqual({
      total: 1500,
      base: 1500,
      platformRate: 0,
      platformTax: 0,
      venueRate: 0,
      venueTax: 0
    });
  });

  it('clamps out-of-range rates into 0-100', () => {
    const r = applyInclusiveTax(500, -5, 150);
    expect(r.platformRate).toBe(0);
    expect(r.venueRate).toBe(100);
    expect(r.base + r.platformTax + r.venueTax).toBe(500);
  });

  it('snapshots the rates used', () => {
    const r = applyInclusiveTax(2000, 10, 5);
    expect(r.platformRate).toBe(10);
    expect(r.venueRate).toBe(5);
  });
});