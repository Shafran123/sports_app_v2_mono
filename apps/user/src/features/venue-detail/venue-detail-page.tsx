"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { venues, featureFlags, toApiFailure } from "@myslot/api";
import { Card, ErrorState, SelectSheet, Skeleton, SkeletonCard } from "@myslot/ui";
import { cn, dayjs, firstSportSlug, formatDuration, formatLkr, toDateKey } from "@myslot/utils";
import type { CourtAvailability, Slot } from "@myslot/types";
import { useAuth } from "@/context/auth";
import { currentHostname, isSiteHost } from "@/lib/site-host";
import { VerifiedPhonePrompt } from "@/features/verify-phone/verified-phone-prompt";
import { VerifyPhoneModal } from "@/features/verify-phone/verify-phone-modal";
import { Gallery } from "./gallery";
import { VenueInfo } from "./venue-info";
import { DatePicker } from "./date-picker";
import { SlotPicker } from "./slot-picker";
import { BookingCta } from "./booking-cta";
import { useAvailability } from "./use-availability";
import { buildCtaHref, applyVenueOffer, durationChoices, longestAvailableRun, selectRun, summarizeSelection, type SelectedSlots } from "./selection";

function VenueDetailSkeleton() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-40 pt-6 md:pb-16">
      <Skeleton className="h-64 w-full rounded-3xl md:h-96" />
      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-full" />
            ))}
          </div>
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="hidden lg:block">
          <Skeleton className="h-64 w-full rounded-3xl" />
        </div>
      </div>
    </main>
  );
}

export function VenueDetailPage({ venueId }: { venueId: string }) {
  const { user } = useAuth();
  const [date, setDate] = useState(() => toDateKey(new Date()));
  const [heroIndex, setHeroIndex] = useState(0);
  const [selected, setSelected] = useState<SelectedSlots>({});
  const [durationMin, setDurationMin] = useState<number>(0);
  const [verifyOpen, setVerifyOpen] = useState(false);

  const flagsQuery = useQuery({
    queryKey: ["feature-flags"],
    queryFn: () => featureFlags.get()
  });
  const flags = flagsQuery.data;

  const venueQuery = useQuery({
    queryKey: ["venue-detail", venueId],
    // A Dedicated Site host carries its hostname so private venues of the
    // site's Business still serve (the site is their storefront, ADR-0029).
    queryFn: () => venues.detail(venueId, isSiteHost(flags?.app_url) ? currentHostname() ?? undefined : undefined)
  });
  const availabilityQuery = useAvailability(venueId, date);

  const venue = venueQuery.data;
  const slug = firstSportSlug(venue?.sports) ?? venue?.courts[0]?.sport_slug ?? null;
  const summary = summarizeSelection(selected, availabilityQuery.data);
  const venueOffer = availabilityQuery.data?.venue_offer ?? null;
  // Display-only: show the venue-wide discounted total in the badge/CTA so the
  // player sees the reduced price before checkout. The server stays
  // authoritative for what is charged.
  const displaySummary = useMemo(() => {
    if (!venueOffer || summary.count === 0) return summary;
    const adj = applyVenueOffer(summary.total, venueOffer);
    return { ...summary, total: adj.total };
  }, [summary, venueOffer]);
  // The checkout link carries the SLOT-LEVEL price (summary.total, not the
  // venue-wide-discounted displaySummary) plus the venue-wide offer params, so
  // checkout applies the offer exactly once (a second application would double
  // the discount: 4500 → 2880 instead of → 3600).
  const href = buildCtaHref({ venueId, venueName: venue?.name, venueSlug: slug, date, venueOffer }, summary);
  const dateLabel = dayjs(date, "YYYY-MM-DD").format("ddd, D MMM");

  const pickDate = (key: string) => {
    setDate(key);
    setSelected({});
    setDurationMin(0);
  };

  const handleToggle = (court: CourtAvailability, slot: Slot) => {
    if (durationMin <= 0) return;
    setSelected((prev) => selectRun(prev, court, slot, durationMin));
  };

  const pickDuration = (min: number) => {
    setDurationMin(min);
    setSelected({});
  };

  if (venueQuery.isLoading) return <VenueDetailSkeleton />;

  if (venueQuery.isError || !venue) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16">
        <ErrorState
          title="Could not load this venue"
          message={venueQuery.error ? toApiFailure(venueQuery.error).message : undefined}
          onRetry={() => venueQuery.refetch()}
        />
      </main>
    );
  }

  const courts = availabilityQuery.data?.courts ?? [];

  return (
    <main className="mx-auto max-w-6xl px-4 pb-40 pt-6 md:pb-16">
      <Gallery
        photos={venue.photos}
        name={venue.name}
        slug={slug}
        index={heroIndex}
        onSelect={setHeroIndex}
      />

      {user && !user.phone_verified_at && flags?.phone_verification_required === true && (
        <div className="mx-auto mt-4 max-w-3xl">
          <VerifiedPhonePrompt onVerify={() => setVerifyOpen(true)} />
        </div>
      )}

      <VerifyPhoneModal open={verifyOpen} onClose={() => setVerifyOpen(false)} />

      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-8">
          <VenueInfo venue={venue} />

          <section id="book-a-slot" className="scroll-mt-24">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl font-extrabold tracking-tight text-ink md:text-2xl">
                Book a slot
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {venueOffer && (
                  <span className="rounded-full bg-success-light px-3 py-1 text-sm font-semibold text-success">
                    {venueOffer.discount_type === "percent"
                      ? `${venueOffer.value}% off today`
                      : `${formatLkr(venueOffer.value)} off today`}
                  </span>
                )}
                {summary.count > 0 && (
                  <span className="rounded-full bg-primary-light px-3 py-1 text-sm font-semibold text-primary">
                    {formatDuration(displaySummary.durationMin)} · {formatLkr(displaySummary.total)}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
              <DatePicker
                selected={date}
                onSelect={pickDate}
                advanceDays={venue.advance_days}
              />
              {courts.length > 0 && (
                <DurationSelector
                  courts={courts}
                  durationMin={durationMin}
                  onPick={pickDuration}
                />
              )}
            </div>
            <div className="mt-4">
              {availabilityQuery.isLoading ? (
                <Skeleton className="h-24 w-full rounded-3xl" />
              ) : availabilityQuery.isError ? (
                <ErrorState title="Could not load availability" onRetry={() => availabilityQuery.refetch()} />
              ) : courts.length === 0 ? (
                <div className="rounded-3xl border border-border bg-surface p-6 text-center text-sm text-ink-3">
                  This venue is closed on the selected day.
                </div>
              ) : (
                <CourtCards
                  courts={courts}
                  date={date}
                  venueAdvanceDays={venue.advance_days}
                  durationMin={durationMin}
                  selected={selected}
                  onToggle={handleToggle}
                />
              )}
            </div>
          </section>
        </div>

        <aside className="hidden lg:block">
          <Card className="sticky top-24 p-5">
            <h3 className="font-display text-lg font-extrabold tracking-tight text-ink">Booking summary</h3>
            <div className="mt-4">
              <BookingCta summary={displaySummary} href={href} dateLabel={dateLabel} stacked />
            </div>
          </Card>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 px-4 md:hidden">
        <div className="rounded-3xl border border-border bg-surface/95 p-3 shadow-lift backdrop-blur">
          <BookingCta summary={displaySummary} href={href} dateLabel={dateLabel} />
        </div>
      </div>
    </main>
  );
}

// Duration selector shown above the court cards, styled like the date picker
// (a bottom-sheet select on mobile). Options are the union of every court's
// valid durations for the day, so one control serves all courts.
function DurationSelector({
  courts,
  durationMin,
  onPick
}: {
  courts: CourtAvailability[];
  durationMin: number;
  onPick: (min: number) => void;
}) {
  const options = useMemo(() => {
    const set = new Set<number>();
    for (const court of courts) {
      for (const min of durationChoices(court, court.slots)) set.add(min);
    }
    return [...set].sort((a, b) => a - b);
  }, [courts]);

  if (options.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="duration-select" className="text-xs font-medium text-ink-2">
        Duration
      </label>
      <SelectSheet
        id="duration-select"
        value={durationMin ? String(durationMin) : ""}
        onChange={(e) => onPick(Number(e.target.value))}
        aria-label="Pick a duration"
        className="w-40"
      >
        <option value="">Select duration</option>
        {options.map((min) => (
          <option key={min} value={min}>
            {formatDuration(min)}
          </option>
        ))}
      </SelectSheet>
    </div>
  );
}

function CourtCards({
  courts,
  date,
  venueAdvanceDays,
  durationMin,
  selected,
  onToggle
}: {
  courts: CourtAvailability[];
  date: string;
  venueAdvanceDays?: number;
  durationMin: number;
  selected: SelectedSlots;
  onToggle: (court: CourtAvailability, slot: Slot) => void;
}) {
  return (
    <div className="space-y-5">
      {courts.map((court) => {
        const availCount = court.slots.filter((s) => s.state === "available").length;
        const fullyBooked = availCount === 0;
        const maxFit = longestAvailableRun(court.slots) * court.slot_duration_min;
        const canFit = durationMin > 0 && durationMin <= maxFit;

        return (
          <Card key={court.court_id} className={cn("p-5", fullyBooked && "opacity-70")}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold tracking-tight text-ink">{court.name}</h3>
                <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-ink-3">
                  {court.sport ?? "Court"} · {court.slot_duration_min} min slots
                </p>
              </div>
              <p className="font-display text-base font-extrabold text-ink">
                {fullyBooked ? (
                  <span className="text-sm font-medium text-ink-3">Fully booked</span>
                ) : (
                  <>
                    {formatLkr(court.price_per_slot)}{" "}
                    <span className="text-xs font-medium text-ink-3">/ slot</span>
                  </>
                )}
              </p>
            </div>

            {!fullyBooked && durationMin === 0 && (
              <p className="mt-4 text-sm text-ink-3">Pick a duration above to see available slots.</p>
            )}

            {!fullyBooked && durationMin > 0 && !canFit && (
              <p className="mt-4 text-sm text-ink-3">
                Not available for {formatDuration(durationMin)}.
              </p>
            )}

            {!fullyBooked && canFit && (
              <div className="mt-4 border-t border-border pt-4">
                <SlotPicker
                  availability={{ date, advance_days: venueAdvanceDays, courts: [court] }}
                  isLoading={false}
                  isError={false}
                  onRetry={() => {}}
                  selected={selected}
                  onToggle={onToggle}
                  slotsCount={durationMin / court.slot_duration_min}
                />
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}