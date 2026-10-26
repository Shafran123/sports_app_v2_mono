/**
 * Public plan price. One plan, full access, unlimited bookings.
 * LKR is a fixed amount (USD price x an agreed rate, rounded) so Sri Lankan
 * venues always see a stable figure; USD is shown to visitors outside Sri Lanka.
 * Billing is off-platform (invoice / bank transfer), so these are display values.
 */
export const PLAN = {
  usdMonthly: 20,
  lkrMonthly: 6000,
  annualDiscountPct: 20
} as const;

export type Currency = "USD" | "LKR";
export type Billing = "monthly" | "annual";

const monthly = (c: Currency) => (c === "USD" ? PLAN.usdMonthly : PLAN.lkrMonthly);

/** Total charged per billing period. Annual = 12 months less the discount. */
export function periodTotal(currency: Currency, billing: Billing): number {
  const m = monthly(currency);
  return billing === "monthly" ? m : Math.round(m * 12 * (1 - PLAN.annualDiscountPct / 100));
}

/** What the plan works out to per month for the chosen billing. */
export function perMonth(currency: Currency, billing: Billing): number {
  return billing === "monthly" ? monthly(currency) : Math.round(periodTotal(currency, "annual") / 12);
}

export function formatPrice(currency: Currency, amount: number): string {
  return `${currency} ${amount.toLocaleString("en-US")}`;
}

/** LKR for visitors in Sri Lanka, USD for everyone else (and when the country is unknown). */
export function defaultCurrency(countryCode: string | null | undefined): Currency {
  return countryCode?.toUpperCase() === "LK" ? "LKR" : "USD";
}
