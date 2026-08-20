"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { sports } from "@spots/api";
import { Skeleton } from "@spots/ui";
import { sportGlyph } from "@spots/utils";
import { SectionHeader } from "./section-header";

const PILL_SKELETONS = Array.from({ length: 8 });

export function PopularSports() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["sports"],
    queryFn: () => sports.list()
  });

  return (
    <section>
      <SectionHeader title="Popular Sports" />
      <div className="-mx-4 mt-4 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {isPending &&
          PILL_SKELETONS.map((_, i) => <Skeleton key={i} className="h-11 w-28 shrink-0 rounded-full" />)}
        {!isPending &&
          !isError &&
          data?.slice(0, 12).map((sport) => (
            <Link
              key={sport.id}
              href={`/explore?sport=${encodeURIComponent(sport.slug)}`}
              className="press flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-ink shadow-soft transition-colors hover:border-primary/40 hover:text-primary"
            >
              <span aria-hidden="true">{sportGlyph(sport.slug)}</span>
              {sport.name}
            </Link>
          ))}
      </div>
    </section>
  );
}