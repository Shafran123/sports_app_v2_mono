import type { CourtPricingRule, VenueHours } from "@myslot/types";

export interface PricingRuleInput {
  day_of_week: number | null;
  start_time: string;
  end_time: string;
  price_per_slot: number;
}

/** Painted slot-times per weekday: dow -> "HH:MM" -> price (never the base price). */
export type Paints = Record<number, Record<string, number>>;

export function toMinutes(t: string): number {
  const [h, m] = t.split(":");
  return Number(h ?? 0) * 60 + Number(m ?? 0);
}

export function fromMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Render an "HH:MM" clock time in 12-hour form ("6:00 PM"). */
export function formatClock(t: string): string {
  const [h, m] = t.split(":");
  const hrNum = Number(h ?? 0);
  const ampm = hrNum >= 12 ? "PM" : "AM";
  const hr = hrNum % 12 === 0 ? 12 : hrNum % 12;
  return `${hr}:${String(Number(m ?? 0)).padStart(2, "0")} ${ampm}`;
}

/**
 * The recurring slot start times a Court offers on a weekday, derived from that
 * day's Opening Windows at the court's slot duration. Mirrors the backend
 * slot generator: a slot occupies [start, start + duration) and must fit
 * entirely inside one opening window.
 */
export function slotsForDay(hours: VenueHours[], dow: number, durationMin: number): string[] {
  const windows = hours.filter((h) => h.day_of_week === dow);
  const starts: string[] = [];
  for (const w of windows) {
    const open = toMinutes(w.open_time);
    const close = toMinutes(w.close_time);
    let t = open;
    while (t + durationMin <= close) {
      starts.push(fromMin(t));
      t += durationMin;
    }
  }
  return starts;
}

function specificity(r: CourtPricingRule): number {
  const day = r.day_of_week !== null ? 1 : 0;
  return day * 1_000_000 - (toMinutes(r.end_time) - toMinutes(r.start_time));
}

/**
 * The effective price for a slot-time under the engine's most-specific-wins
 * rule (a day-specific rule beats a day-agnostic one; among equally specific
 * rules the narrower window wins). Returns null when no rule applies.
 */
export function priceForSlot(rules: CourtPricingRule[], dow: number, startTime: string): number | null {
  const t = toMinutes(startTime);
  let best: { specificity: number; price: number } | null = null;
  for (const r of rules) {
    if (r.day_of_week !== null && r.day_of_week !== dow) continue;
    const s = toMinutes(r.start_time);
    const e = toMinutes(r.end_time);
    if (s <= t && t < e) {
      const spec = specificity(r);
      if (best === null || spec > best.specificity) {
        best = { specificity: spec, price: r.price_per_slot };
      }
    }
  }
  return best ? best.price : null;
}

/**
 * Flatten stored rules onto the current weekly grid. Only slot-times that
 * exist in today's opening hours are painted; a rule pricing at the court's
 * base price paints nothing (it is indistinguishable from unpainted).
 */
export function flattenRulesToPaints(
  rules: CourtPricingRule[],
  hours: VenueHours[],
  basePrice: number,
  durationMin: number
): Paints {
  const paints: Paints = {};
  for (let dow = 0; dow < 7; dow++) {
    const dayPaints: Record<string, number> = {};
    for (const start of slotsForDay(hours, dow, durationMin)) {
      const price = priceForSlot(rules, dow, start);
      if (price !== null && price !== basePrice) dayPaints[start] = price;
    }
    if (Object.keys(dayPaints).length > 0) paints[dow] = dayPaints;
  }
  return paints;
}

/**
 * How many stored rules currently cover zero scheduled slot-times on the days
 * they apply to. These would silently vanish on a whole-schedule save because
 * the grid is built from current opening hours — surface them as a warning.
 */
export function countDeadRules(rules: CourtPricingRule[], hours: VenueHours[], durationMin: number): number {
  let dead = 0;
  for (const r of rules) {
    const days = r.day_of_week === null ? [0, 1, 2, 3, 4, 5, 6] : [r.day_of_week];
    const s = toMinutes(r.start_time);
    const e = toMinutes(r.end_time);
    let covered = 0;
    for (const dow of days) {
      for (const start of slotsForDay(hours, dow, durationMin)) {
        const t = toMinutes(start);
        if (s <= t && t < e) covered++;
      }
    }
    if (covered === 0) dead++;
  }
  return dead;
}

/**
 * Collapse painted cells back into contiguous same-price windows (one rule per
 * run, per day). A run's end is the last painted start plus one slot, so every
 * produced window lies inside the opening hours it came from.
 */
export function paintsToRules(paints: Paints, hours: VenueHours[], durationMin: number): PricingRuleInput[] {
  const rules: PricingRuleInput[] = [];
  for (let dow = 0; dow < 7; dow++) {
    const day = paints[dow];
    if (!day) continue;
    const painted = slotsForDay(hours, dow, durationMin)
      .filter((c) => day[c] !== undefined)
      .sort((a, b) => toMinutes(a) - toMinutes(b));
    let i = 0;
    while (i < painted.length) {
      const first = painted[i]!;
      const firstPrice = day[first]!;
      let j = i;
      while (j + 1 < painted.length) {
        const cur = painted[j]!;
        const next = painted[j + 1]!;
        if (day[next] !== firstPrice || toMinutes(next) !== toMinutes(cur) + durationMin) break;
        j++;
      }
      const last = painted[j]!;
      rules.push({
        day_of_week: dow,
        start_time: first,
        end_time: fromMin(toMinutes(last) + durationMin),
        price_per_slot: firstPrice
      });
      i = j + 1;
    }
  }
  return rules;
}