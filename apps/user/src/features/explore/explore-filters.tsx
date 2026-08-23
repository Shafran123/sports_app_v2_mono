"use client";

import { useQuery } from "@tanstack/react-query";
import { sports } from "@myslot/api";
import { Checkbox, Input, SelectSheet } from "@myslot/ui";

export interface ExploreFiltersProps {
  sport: string;
  city: string;
  minPrice: string;
  maxPrice: string;
  indoor: boolean;
  onChange: (key: string, value: string) => void;
}

export function ExploreFilters({ sport, city, minPrice, maxPrice, indoor, onChange }: ExploreFiltersProps) {
  const { data: sportOptions } = useQuery({
    queryKey: ["sports"],
    queryFn: () => sports.list()
  });

  return (
    <div className="rounded-3xl border border-border bg-surface p-4 shadow-soft md:p-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label htmlFor="explore-sport" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-3">
            Sport
          </label>
          <SelectSheet
            id="explore-sport"
            value={sport}
            onChange={(e) => onChange("sport", e.target.value)}
            aria-label="Filter by sport"
          >
            <option value="">All sports</option>
            {sportOptions?.map((s) => (
              <option key={s.id} value={s.slug}>
                {s.name}
              </option>
            ))}
          </SelectSheet>
        </div>
        <div>
          <label htmlFor="explore-city" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-3">
            City
          </label>
          <Input
            id="explore-city"
            value={city}
            onChange={(e) => onChange("city", e.target.value)}
            placeholder="Any city"
            aria-label="Filter by city"
          />
        </div>
        <div>
          <label htmlFor="explore-min-price" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-3">
            Min price
          </label>
          <Input
            id="explore-min-price"
            type="number"
            min={0}
            inputMode="numeric"
            value={minPrice}
            onChange={(e) => onChange("min_price", e.target.value)}
            placeholder="Any"
            aria-label="Minimum price"
          />
        </div>
        <div>
          <label htmlFor="explore-max-price" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-3">
            Max price
          </label>
          <Input
            id="explore-max-price"
            type="number"
            min={0}
            inputMode="numeric"
            value={maxPrice}
            onChange={(e) => onChange("max_price", e.target.value)}
            placeholder="Any"
            aria-label="Maximum price"
          />
        </div>
        <label
          className="flex select-none items-center gap-2.5 lg:mb-0.5 lg:self-end"
          aria-label="Indoor venues only"
        >
          <Checkbox
            checked={indoor}
            onChange={(e) => onChange("indoor", e.target.checked ? "1" : "")}
            className="h-5 w-5"
          />
          <span className="text-sm font-medium text-ink-2">Indoor only</span>
        </label>
      </div>
    </div>
  );
}