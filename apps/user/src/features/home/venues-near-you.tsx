"use client";

import { useQuery } from "@tanstack/react-query";
import { venues } from "@spots/api";
import { EmptyState, ErrorState, SkeletonCard, VenueCard } from "@spots/ui";
import { SectionHeader } from "./section-header";

const CARD_SKELETONS = Array.from({ length: 6 });

export function VenuesNearYou() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["venues", "near-you"],
    queryFn: () => venues.list({ limit: 6 })
  });

  const venueList = data?.data ?? [];

  return (
    <section>
      <SectionHeader title="Venues near you" />
      {isPending ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARD_SKELETONS.map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : isError ? (
        <div className="mt-4">
          <ErrorState onRetry={() => refetch()} />
        </div>
      ) : venueList.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No venues nearby yet"
            message="Courts and clubs near you will appear here as they join Spots."
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {venueList.map((venue) => (
            <VenueCard key={venue.id} venue={venue} />
          ))}
        </div>
      )}
    </section>
  );
}