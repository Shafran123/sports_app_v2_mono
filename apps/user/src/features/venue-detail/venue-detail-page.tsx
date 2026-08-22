"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { venues, toApiFailure } from "@spots/api";
import { Card, ErrorState, Skeleton, SkeletonCard } from "@spots/ui";
import { dayjs, firstSportSlug, formatLkr, toDateKey } from "@spots/utils";
import type { CourtAvailability, Slot } from "@spots/types";
import { Gallery } from "./gallery";
import { VenueInfo } from "./venue-info";
import { DateStrip } from "./date-strip";
import { SlotPicker } from "./slot-picker";
import { BookingCta } from "./booking-cta";
import { useAvailability } from "./use-availability";
import { buildCtaHref, summarizeSelection, toggleSlot, type SelectedSlots } from "./selection";

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
  const [date, setDate] = useState(() => toDateKey(new Date()));
  const [heroIndex, setHeroIndex] = useState(0);
  const [selected, setSelected] = useState<SelectedSlots>({});

  const venueQuery = useQuery({
    queryKey: ["venue-detail", venueId],
    queryFn: () => venues.detail(venueId)
  });
  const availabilityQuery = useAvailability(venueId, date);

  const venue = venueQuery.data;
  const slug = firstSportSlug(venue?.sports) ?? venue?.courts[0]?.sport_slug ?? null;
  const summary = summarizeSelection(selected, availabilityQuery.data);
  const href = buildCtaHref({ venueId, venueName: venue?.name, venueSlug: slug, date }, summary);
  const dateLabel = dayjs(date, "YYYY-MM-DD").format("ddd, D MMM");

  const pickDate = (key: string) => {
    setDate(key);
    setSelected({});
  };

  const handleToggle = (court: CourtAvailability, slot: Slot) => {
    setSelected((prev) => toggleSlot(prev, court, slot));
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

  return (
    <main className="mx-auto max-w-6xl px-4 pb-40 pt-6 md:pb-16">
      <Gallery
        photos={venue.photos}
        name={venue.name}
        slug={slug}
        index={heroIndex}
        onSelect={setHeroIndex}
      />

      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-8">
          <VenueInfo venue={venue} />

          <section id="book-a-slot" className="scroll-mt-24">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl font-extrabold tracking-tight text-ink md:text-2xl">
                Book a slot
              </h2>
              {summary.count > 0 && (
                <span className="rounded-full bg-primary-light px-3 py-1 text-sm font-semibold text-primary">
                  {summary.count} selected · {formatLkr(summary.total)}
                </span>
              )}
            </div>
            <DateStrip selected={date} onSelect={pickDate} />
            <p className="mt-3 text-xs text-ink-3">Pick up to 8 consecutive slots on a single court.</p>
            <div className="mt-4">
              <SlotPicker
                availability={availabilityQuery.data}
                isLoading={availabilityQuery.isLoading}
                isError={availabilityQuery.isError}
                onRetry={() => availabilityQuery.refetch()}
                selected={selected}
                onToggle={handleToggle}
              />
            </div>
          </section>
        </div>

        <aside className="hidden lg:block">
          <Card className="sticky top-24 p-5">
            <h3 className="font-display text-lg font-extrabold tracking-tight text-ink">Booking summary</h3>
            <div className="mt-4">
              <BookingCta summary={summary} href={href} dateLabel={dateLabel} stacked />
            </div>
          </Card>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 px-4 md:hidden">
        <div className="rounded-3xl border border-border bg-surface/95 p-3 shadow-lift backdrop-blur">
          <BookingCta summary={summary} href={href} dateLabel={dateLabel} />
        </div>
      </div>
    </main>
  );
}