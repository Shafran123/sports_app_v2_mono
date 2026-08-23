"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { business, venues } from "@myslot/api";
import { Button, EmptyState, SelectSheet, Skeleton } from "@myslot/ui";
import { dayjs, toDateKey } from "@myslot/utils";
import type { CourtAvailability, Slot } from "@myslot/types";
import { AvailabilityView } from "./availability-view";
import { DateStrip } from "./date-strip";
import { ManualBookingDialog } from "./manual-booking-dialog";
import { BookingDetailDialog } from "./booking-detail-dialog";

function sameInstant(a: string, b: string): boolean {
  return new Date(a).getTime() === new Date(b).getTime();
}

export function CalendarPage() {
  const todayKey = toDateKey(new Date());
  const [dateKey, setDateKey] = useState(todayKey);
  const [venueId, setVenueId] = useState<string | undefined>(undefined);
  const [pickedSlot, setPickedSlot] = useState<{ court: CourtAvailability; slot: Slot } | null>(null);
  const [pickedBooked, setPickedBooked] = useState<{ court: CourtAvailability; slot: Slot } | null>(null);

  const venuesQuery = useQuery({
    queryKey: ["admin-venues"],
    queryFn: () => venues.mine()
  });
  const venuesList = venuesQuery.data ?? [];
  const selectedVenueId = venueId ?? venuesList[0]?.id;
  const selectedVenue = venuesList.find((v) => v.id === selectedVenueId);

  const availabilityQuery = useQuery({
    queryKey: ["admin-availability", selectedVenueId, dateKey],
    queryFn: () => venues.availability(selectedVenueId!, dateKey),
    enabled: !!selectedVenueId,
    staleTime: 0
  });

  const dayQuery = useQuery({
    queryKey: ["admin-bookings", dateKey],
    queryFn: () => business.listBookings({ date: dateKey }),
    enabled: !!selectedVenueId
  });

  const pickedBooking = useMemo(() => {
    if (!pickedBooked || !dayQuery.data) return undefined;
    return dayQuery.data.data.find(
      (b) =>
        b.court_id === pickedBooked.court.court_id &&
        sameInstant(b.start_at, pickedBooked.slot.start_at)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedBooked, dayQuery.data]);

  if (venuesQuery.isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-11 w-full rounded-2xl sm:w-64" />
        <Skeleton className="h-16 w-full rounded-3xl" />
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-3xl" />
          ))}
        </div>
      </div>
    );
  }

  if (venuesQuery.isError || venuesList.length === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        <EmptyState
          title="No venues to manage"
          message={venuesQuery.isError ? "We could not load your venues. Please try again." : "Create or get approved for a venue before using the operator calendar."}
          actionLabel={venuesQuery.isError ? "Try again" : undefined}
          onAction={venuesQuery.isError ? () => venuesQuery.refetch() : undefined}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">Calendar</h1>
        <p className="mt-1 text-sm text-ink-2">Day view — book walk-ins and run your court floor.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full space-y-1.5 sm:w-64">
          <label htmlFor="calendar-venue" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
            Venue
          </label>
          <SelectSheet
            id="calendar-venue"
            value={selectedVenueId ?? ""}
            onChange={(e) => setVenueId(e.target.value)}
            className="w-full"
          >
            {venuesList.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </SelectSheet>
        </div>
        {dateKey !== todayKey && (
          <Button variant="secondary" size="sm" onClick={() => setDateKey(todayKey)}>
            Today
          </Button>
        )}
      </div>

      <DateStrip selected={dateKey} onSelect={setDateKey} />
      <p className="text-xs text-ink-3">{dayjs(dateKey, "YYYY-MM-DD").format("dddd, D MMMM")}</p>

      <AvailabilityView
        availability={availabilityQuery.data}
        isLoading={availabilityQuery.isLoading}
        isError={availabilityQuery.isError}
        onRetry={() => availabilityQuery.refetch()}
        onSlotClick={(court, slot) => {
          if (slot.state === "available") {
            setPickedSlot({ court, slot });
          } else if (slot.state === "booked") {
            setPickedBooked({ court, slot });
          }
        }}
      />

      <ManualBookingDialog
        open={!!pickedSlot}
        onOpenChange={(o) => {
          if (!o) setPickedSlot(null);
        }}
        venueId={selectedVenueId}
        dateKey={dateKey}
        venueName={selectedVenue?.name}
        court={pickedSlot?.court ?? null}
        slot={pickedSlot?.slot ?? null}
        onRefresh={() => availabilityQuery.refetch()}
      />

      <BookingDetailDialog
        open={!!pickedBooked}
        onOpenChange={(o) => {
          if (!o) setPickedBooked(null);
        }}
        venueName={selectedVenue?.name}
        court={pickedBooked?.court ?? null}
        slot={pickedBooked?.slot ?? null}
        booking={pickedBooking ?? null}
      />
    </div>
  );
}