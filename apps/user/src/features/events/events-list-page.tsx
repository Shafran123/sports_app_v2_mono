"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { MapPin, SearchX } from "lucide-react";
import { events, sports } from "@spots/api";
import { ActivityCard, Button, EmptyState, ErrorState, Input, SelectSheet, SkeletonCard } from "@spots/ui";
import type { Event } from "@spots/types";

const LIMIT = 9;

export function EventsListPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const city = sp.get("city") ?? "";
  const sport = sp.get("sport") ?? "";

  const [cityInput, setCityInput] = useState(city);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setCityInput(city);
  }, [city]);

  useEffect(() => {
    if (cityInput === city) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(sp);
      const trimmed = cityInput.trim();
      if (trimmed) next.set("city", trimmed);
      else next.delete("city");
      router.replace(next.size ? `/events?${next}` : "/events", { scroll: false });
    }, 400);
    return () => clearTimeout(timer);
  }, [cityInput, city, router, sp]);

  useEffect(() => {
    setPage(1);
  }, [city, sport]);

  const sportsQuery = useQuery({
    queryKey: ["sports"],
    queryFn: () => sports.list()
  });

  const listQuery = useQuery({
    queryKey: ["events", city, sport, page],
    queryFn: () =>
      events.list({
        city: city || undefined,
        sport: sport || undefined,
        page,
        limit: LIMIT
      })
  });

  const [items, setItems] = useState<Event[]>([]);

  useEffect(() => {
    if (!listQuery.data) return;
    setItems((prev) => (page === 1 ? listQuery.data : [...prev, ...listQuery.data]));
  }, [listQuery.data, page]);

  const isLoading = listQuery.isLoading;
  const isError = listQuery.isError;
  const hasMore = (listQuery.data?.length ?? LIMIT) >= LIMIT;

  const updateSport = (value: string) => {
    const next = new URLSearchParams(sp);
    if (value) next.set("sport", value);
    else next.delete("sport");
    router.replace(next.size ? `/events?${next}` : "/events", { scroll: false });
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 md:pb-14">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">Events</h1>
        <p className="mt-1 text-sm text-ink-2">Tournaments, games and meetups near you.</p>
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <Input
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            placeholder="Filter by city"
            className="pl-10"
          />
        </div>
        <SelectSheet value={sport} onChange={(e) => updateSport(e.target.value)} className="sm:w-56">
          <option value="">All sports</option>
          {sportsQuery.data?.map((s) => (
            <option key={s.id} value={s.slug}>
              {s.name}
            </option>
          ))}
        </SelectSheet>
      </div>

      {isError && items.length === 0 ? (
        <ErrorState
          className="mt-8"
          title="Could not load events"
          message="We could not load events right now. Please try again."
          onRetry={() => listQuery.refetch()}
        />
      ) : isLoading && items.length === 0 ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={SearchX}
          title="No events yet"
          message="There are no events matching your filters right now. Check back soon or explore venues nearby."
          actionLabel="Explore venues"
          onAction={() => router.push("/explore")}
        />
      ) : (
        <>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((event) => (
              <ActivityCard key={event.id} event={event} onAction={() => router.push(`/events/${event.id}`)} />
            ))}
          </div>
          {hasMore && (
            <div className="mt-8 flex justify-center">
              <Button variant="secondary" loading={listQuery.isFetching} onClick={() => setPage((p) => p + 1)}>
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  );
}