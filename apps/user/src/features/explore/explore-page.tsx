"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { venues } from "@spots/api";
import type { Venue } from "@spots/types";
import { Input } from "@spots/ui";
import { ExploreFilters } from "./explore-filters";
import { VenueResults } from "./venue-results";

const LIMIT = 12;
const SEARCH_DEBOUNCE_MS = 400;

export function ExplorePage() {
  const router = useRouter();
  const params = useSearchParams();
  const paramsRef = useRef(params);

  const search = params.get("search") ?? "";
  const sport = params.get("sport") ?? "";
  const city = params.get("city") ?? "";
  const minPrice = params.get("min_price") ?? "";
  const maxPrice = params.get("max_price") ?? "";
  const indoor = params.get("indoor") === "1";

  const [searchInput, setSearchInput] = useState(search);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Venue[]>([]);
  const [total, setTotal] = useState(0);
  const loadedPages = useRef(new Set<number>());

  const filterKey = useMemo(
    () => JSON.stringify({ search, sport, city, minPrice, maxPrice, indoor }),
    [search, sport, city, minPrice, maxPrice, indoor]
  );

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    if (searchInput === search) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(paramsRef.current.toString());
      if (searchInput === "") {
        next.delete("search");
      } else {
        next.set("search", searchInput);
      }
      const queryString = next.toString();
      router.replace(queryString ? `/explore?${queryString}` : "/explore", { scroll: false });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, search, router]);

  useEffect(() => {
    setPage(1);
  }, [filterKey]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(paramsRef.current.toString());
    if (value === "") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    const queryString = next.toString();
    router.replace(queryString ? `/explore?${queryString}` : "/explore", { scroll: false });
  }

  function clearFilters() {
    setSearchInput("");
    router.replace("/explore", { scroll: false });
  }

  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ["explore-venues", filterKey, page],
    queryFn: () =>
      venues.list(undefined, {
        ...(search ? { search } : {}),
        ...(sport ? { sport } : {}),
        ...(city ? { city } : {}),
        ...(minPrice ? { min_price: Number(minPrice) } : {}),
        ...(maxPrice ? { max_price: Number(maxPrice) } : {}),
        ...(indoor ? { indoor: 1 as const } : {}),
        page,
        limit: LIMIT
      })
  });

  useEffect(() => {
    if (!data) return;
    if (data.meta.page <= 1) {
      loadedPages.current = new Set([data.meta.page]);
      setItems(data.data);
    } else if (!loadedPages.current.has(data.meta.page)) {
      loadedPages.current.add(data.meta.page);
      setItems((prev) => [...prev, ...data.data]);
    }
    setTotal(data.meta.total);
  }, [data]);

  const hasMore = total > items.length;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 pb-24 pt-8 md:pb-16">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink md:text-4xl">Explore</h1>
          <p className="mt-1 text-sm text-ink-2">Find courts, pitches and clubs near you.</p>
        </div>
        <div className="relative w-full md:max-w-sm">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search venues, sports or activities"
            aria-label="Search venues, sports or activities"
            className="h-12 rounded-full pl-11"
          />
        </div>
      </div>

      <ExploreFilters
        sport={sport}
        city={city}
        minPrice={minPrice}
        maxPrice={maxPrice}
        indoor={indoor}
        onChange={setParam}
      />

      <VenueResults
        items={items}
        hasMore={hasMore}
        isPending={isPending}
        isError={isError}
        isFetching={isFetching}
        onLoadMore={() => setPage((p) => p + 1)}
        onRetry={() => refetch()}
        onClearFilters={clearFilters}
      />
    </main>
  );
}