"use client";

import { useQuery } from "@tanstack/react-query";
import { venues } from "@myslot/api";

export function useAvailability(venueId: string, date: string) {
  return useQuery({
    queryKey: ["venue-availability", venueId, date],
    queryFn: () => venues.availability(venueId, date),
    staleTime: 0
  });
}