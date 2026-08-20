"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, MapPin, Plus } from "lucide-react";
import { Button, EmptyState, ErrorState, SkeletonCard, StatusPill } from "@spots/ui";
import { fetchMyVenues, type MyVenue } from "./venue-api";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected"
};

function VenueCardRow({ venue }: { venue: MyVenue }) {
  return (
    <Link href={`/venues/${venue.id}`} className="press-raise group flex h-full flex-col rounded-3xl border border-border bg-surface shadow-soft">
      <div className="flex items-center gap-3 p-5 pb-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-primary">
          <Building2 className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold tracking-tight text-ink">{venue.name}</h3>
          <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-ink-2">
            <MapPin className="h-3.5 w-3.5 shrink-0" /> {venue.city}
          </p>
        </div>
        <StatusPill status={venue.status}>{STATUS_LABEL[venue.status] ?? venue.status}</StatusPill>
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-border px-5 py-4">
        <p className="text-sm text-ink-2">
          <span className="font-semibold text-ink">{venue.court_count ?? 0}</span> courts
        </p>
        <span className="flex items-center gap-1 text-sm font-semibold text-primary transition-colors group-hover:text-primary-hover">
          Open <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

export function VenuesPage() {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-venues"],
    queryFn: () => fetchMyVenues()
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">
            My venues
          </h1>
          <p className="mt-1 text-sm text-ink-2">Manage your venues, courts, hours and slot blocks.</p>
        </div>
        <Button onClick={() => router.push("/venues/new")}>
          <Plus className="h-4 w-4" /> Add venue
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} className="h-44" />
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorState
          title="Could not load your venues"
          message="We could not load your venues right now. Please try again."
          onRetry={() => refetch()}
        />
      ) : data.length === 0 ? (
        <EmptyState
          title="No venues yet — add your first venue"
          message="Submit your venue for review and start taking bookings once it goes live."
          actionLabel="Add your first venue"
          onAction={() => router.push("/venues/new")}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((venue) => (
            <VenueCardRow key={venue.id} venue={venue} />
          ))}
        </div>
      )}
    </div>
  );
}