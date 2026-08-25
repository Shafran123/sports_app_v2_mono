// Pricing engine: variable (peak/off-peak) slot prices and server-applied
// offers. This is the single seam the availability controller, checkout, and
// the walk-in/manual booking path all use, so the price a player sees, the
// price a walk-in pays, and the price checkout collects are always the same.
//
// Rules:
// - A slot's base price is its court price_per_slot, overridden by the most
//   specific matching court_pricing_rule (a day-specific rule beats a day-
//   agnostic one; then the narrower window wins).
// - Slot-based offers discount individual slots (best single slot offer).
// - Venue-wide offers discount the whole booking (best single venue offer).
// - Stacking is best-per-kind: best slot offer + best venue offer, never two
//   of the same kind compounding. Discounts always apply to the peak-adjusted
//   (rule) price.

const { dayOfWeekOf, colomboDate, colomboTime, toMinutes, fromMinutes } = require('../utils/colombo');

async function pricingRulesForCourt(client, courtId) {
  const { rows } = await client.query(
    `select day_of_week, start_time, end_time, price_per_slot
     from court_pricing_rules where court_id = $1`,
    [courtId]
  );
  return rows.map((r) => ({
    day_of_week: r.day_of_week === null ? null : Number(r.day_of_week),
    start_time: r.start_time.slice(0, 5),
    end_time: r.end_time.slice(0, 5),
    price_per_slot: Number(r.price_per_slot)
  }));
}

// Base price for a slot's start time (HH:MM, local) against a court's pricing
// rules. Most-specific-wins: a rule with a matching day_of_week beats a
// day-agnostic one; among equally-specific rules the shorter window wins.
function slotPriceForRule(rules, basePrice, dow, timeMin) {
  const matches = rules.filter(
    (r) =>
      (r.day_of_week === null || r.day_of_week === dow) &&
      toMinutes(r.start_time) <= timeMin &&
      timeMin < toMinutes(r.end_time)
  );
  if (matches.length === 0) return basePrice;
  matches.sort((a, b) => {
    const aDay = a.day_of_week !== null ? 1 : 0;
    const bDay = b.day_of_week !== null ? 1 : 0;
    if (aDay !== bDay) return bDay - aDay;
    const aDur = toMinutes(a.end_time) - toMinutes(a.start_time);
    const bDur = toMinutes(b.end_time) - toMinutes(b.start_time);
    return aDur - bDur;
  });
  return matches[0].price_per_slot;
}

// Offers active for a venue on a local date (is_active and within any
// start/end dates). Returns normalized offers with a single `value`.
async function eligibleOffers(client, venueId, dateStr) {
  const { rows } = await client.query(
    `select id, kind, discount_type, percent, flat_amount, start_date, end_date
     from offers
     where venue_id = $1 and is_active = true
       and (start_date is null or start_date <= $2::date)
       and (end_date is null or end_date >= $2::date)`,
    [venueId, dateStr]
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    discount_type: r.discount_type,
    value: r.discount_type === 'percent' ? Number(r.percent) : Number(r.flat_amount),
    start_date: r.start_date,
    end_date: r.end_date
  }));
}

async function slotOffersForVenue(client, venueId, dateStr) {
  const offers = (await eligibleOffers(client, venueId, dateStr)).filter((o) => o.kind === 'slot');
  if (offers.length === 0) return { offers: [], scopes: [], windows: [] };

  const ids = offers.map((o) => o.id);
  const { rows: scopes } = await client.query(
    `select offer_id, court_id from offer_scopes where offer_id = any($1)`,
    [ids]
  );
  const { rows: windows } = await client.query(
    `select offer_id, day_of_week, start_time, end_time from offer_windows where offer_id = any($1)`,
    [ids]
  );

  return {
    offers,
    scopes: scopes.map((s) => ({ offer_id: s.offer_id, court_id: s.court_id })),
    windows: windows.map((w) => ({
      offer_id: w.offer_id,
      day_of_week: w.day_of_week === null ? null : Number(w.day_of_week),
      start_time: w.start_time.slice(0, 5),
      end_time: w.end_time.slice(0, 5)
    }))
  };
}

function discountForOffer(offer, amount) {
  if (offer.discount_type === 'percent') return Math.round(amount * offer.value / 100);
  return Math.min(offer.value, amount);
}

// Best slot-offer discount for one slot (never compounds).
function bestSlotDiscount(bundle, courtId, dow, timeMin, slotPrice) {
  if (!bundle.offers.length) return 0;
  let best = 0;
  for (const offer of bundle.offers) {
    const scoped = bundle.scopes.filter((s) => s.offer_id === offer.id);
    if (scoped.length > 0 && !scoped.some((s) => s.court_id === courtId)) continue;

    const windows = bundle.windows.filter((w) => w.offer_id === offer.id);
    if (windows.length > 0) {
      const inWindow = windows.some(
        (w) =>
          (w.day_of_week === null || w.day_of_week === dow) &&
          toMinutes(w.start_time) <= timeMin &&
          timeMin < toMinutes(w.end_time)
      );
      if (!inWindow) continue;
    }

    const discount = discountForOffer(offer, slotPrice);
    if (discount > best) best = discount;
  }
  return best;
}

// Best venue-wide discount off the whole (rule-adjusted) subtotal.
function bestVenueDiscount(offers, subtotal) {
  let best = 0;
  for (const offer of offers) {
    if (offer.kind !== 'venue') continue;
    const discount = discountForOffer(offer, subtotal);
    if (discount > best) best = discount;
  }
  return best;
}

// Full pricing for a booking range on one court. `start`/`end` are UTC
// instants; the local date and slot times are derived in Colombo time.
async function computePricing(client, court, startIso, endIso) {
  const dateStr = colomboDate(startIso);
  const rules = await pricingRulesForCourt(client, court.id);
  const slotBundle = await slotOffersForVenue(client, court.venue_id, dateStr);
  const venueOffers = (await eligibleOffers(client, court.venue_id, dateStr)).filter((o) => o.kind === 'venue');

  const dow = dayOfWeekOf(dateStr);
  const dur = Number(court.slot_duration_min);
  const start = toMinutes(colomboTime(startIso));
  const end = toMinutes(colomboTime(endIso));

  const slots = [];
  let t = start;
  while (t < end) {
    const timeStr = fromMinutes(t);
    const base = slotPriceForRule(rules, Number(court.price_per_slot), dow, t);
    const discount = bestSlotDiscount(slotBundle, court.id, dow, t, base);
    const price = Math.max(0, base - discount);
    slots.push({
      start_time: timeStr,
      end_time: fromMinutes(t + dur),
      base_price: base,
      price,
      offer_price: discount > 0 ? price : null
    });
    t += dur;
  }

  const subtotal = slots.reduce((sum, s) => sum + s.price, 0);
  const venueDiscount = bestVenueDiscount(venueOffers, subtotal);
  const total = Math.max(0, subtotal - venueDiscount);

  return { date: dateStr, slots, subtotal, discount: venueDiscount, total };
}

// Single-slot pricing (for the availability endpoint): per-slot base +
// optional offer price, without needing a booking range.
async function slotPricing(client, court, dateStr, startTimeStr) {
  const rules = await pricingRulesForCourt(client, court.id);
  const slotBundle = await slotOffersForVenue(client, court.venue_id, dateStr);
  const dow = dayOfWeekOf(dateStr);
  const timeMin = toMinutes(startTimeStr);
  const base = slotPriceForRule(rules, Number(court.price_per_slot), dow, timeMin);
  const discount = bestSlotDiscount(slotBundle, court.id, dow, timeMin, base);
  const price = Math.max(0, base - discount);
  return { base_price: base, price, offer_price: discount > 0 ? price : null };
}

module.exports = {
  pricingRulesForCourt,
  slotPriceForRule,
  eligibleOffers,
  slotOffersForVenue,
  bestSlotDiscount,
  bestVenueDiscount,
  computePricing,
  slotPricing
};