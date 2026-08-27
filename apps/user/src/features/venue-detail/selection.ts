import type { VenueOffer } from "@myslot/types";
import {
  MAX_SLOTS,
  durationChoices,
  longestAvailableRun,
  selectRun,
  selectionKey,
  summarizeSelection,
  type SelectedSlots,
  type SelectionSummary
} from "@myslot/utils";

export { MAX_SLOTS, durationChoices, longestAvailableRun, selectRun, selectionKey, summarizeSelection };
export type { SelectedSlots, SelectionSummary };

// Display-only application of a venue-wide offer to an amount (mirrors the
// server's math: percent or flat off the subtotal, half-up rounding). The
// server remains authoritative at checkout — this only drives the pre-checkout
// display so the player sees the reduced price before confirming.
export function applyVenueOffer(
  amount: number,
  offer?: VenueOffer | null
): { total: number; discount: number } {
  if (!offer || !Number.isFinite(amount) || amount <= 0) return { total: amount, discount: 0 };
  const discount =
    offer.discount_type === "percent"
      ? Math.round((amount * offer.value) / 100)
      : Math.min(offer.value, amount);
  return { total: Math.max(0, amount - discount), discount };
}

/**
 * Contract with /book/[venueId]: date, court_id, start_at, end_at (ISO
 * strings), plus the display names and pricing the checkout/confirmation
 * screens render before/after the API round-trip. The `slot_min` duration is
 * carried so checkout can show "1h 30m × Rs 1,500" instead of a slot count.
 */
export function buildCtaHref(
  { venueId, venueName, venueSlug, date, venueOffer }: { venueId: string; venueName: string | null | undefined; venueSlug: string | null | undefined; date: string; venueOffer?: VenueOffer | null },
  summary: SelectionSummary
): string {
  if (summary.count === 0 || !summary.courtId || !summary.startAt || !summary.endAt) return "";
  const params = new URLSearchParams({
    date,
    court_id: summary.courtId,
    start_at: summary.startAt,
    end_at: summary.endAt,
    venue: venueName ?? "",
    venue_slug: venueSlug ?? "",
    court: summary.courtName ?? "",
    price_per_slot: String(Math.round(summary.total / summary.count)),
    base_price_per_slot: String(Math.round(summary.baseTotal / summary.count)),
    slots: String(summary.count),
    slot_min: String(summary.durationMin)
  });
  if (venueOffer) {
    params.set("venue_offer_type", venueOffer.discount_type);
    params.set("venue_offer_value", String(venueOffer.value));
  }
  return `/book/${venueId}?${params.toString()}`;
}