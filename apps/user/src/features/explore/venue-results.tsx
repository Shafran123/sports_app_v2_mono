"use client";

import { FilterX } from "lucide-react";
import type { Venue } from "@spots/types";
import { Button, EmptyState, ErrorState, SkeletonCard, VenueCard } from "@spots/ui";

const CARD_SKELETONS = Array.from({ length: 6 });

export interface VenueResultsProps {
  items: Venue[];
  hasMore: boolean;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  onClearFilters: () => void;
}

export function VenueResults({
  items,
  hasMore,
  isPending,
  isError,
  isFetching,
  onLoadMore,
  onRetry,
  onClearFilters
}: VenueResultsProps) {
  if (isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARD_SKELETONS.map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return <ErrorState onRetry={onRetry} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="No venues match your filters"
        message="Try widening your search or clearing the filters below."
        actionLabel="Clear filters"
        onAction={onClearFilters}
        icon={FilterX}
      />
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((venue) => (
          <VenueCard key={venue.id} venue={venue} />
        ))}
      </div>
      {hasMore && (
        <div className="mt-8 flex justify-center">
          <Button variant="secondary" size="lg" onClick={onLoadMore} loading={isFetching} className="min-w-48">
            Load more venues
          </Button>
        </div>
      )}
    </>
  );
}