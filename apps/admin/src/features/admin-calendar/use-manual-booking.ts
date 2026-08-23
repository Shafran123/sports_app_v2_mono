"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { business } from "@myslot/api";
import type { Availability } from "@myslot/types";
import type { ManualBookingInput } from "@myslot/types";

function markSlotBooked(availability: Availability | undefined, courtId: string, startAt: string): Availability | undefined {
  if (!availability) return availability;
  return {
    ...availability,
    courts: availability.courts.map((c) =>
      c.court_id === courtId
        ? {
            ...c,
            slots: c.slots.map((s) => (s.start_at === startAt ? { ...s, state: "booked" as const } : s))
          }
        : c
    )
  };
}

export function useManualBooking(venueId: string | undefined, dateKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ManualBookingInput) => business.manualBooking(input),
    onSuccess: (_data, input) => {
      if (venueId) {
        queryClient.setQueryData<Availability>(["admin-availability", venueId, dateKey], (old) =>
          markSlotBooked(old, input.court_id, input.start_at)
        );
        queryClient.invalidateQueries({ queryKey: ["admin-availability", venueId, dateKey] });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
    }
  });
}