"use client";

import { VenueVisual } from "@myslot/ui";
import { cn } from "@myslot/utils";

export function Gallery({
  photos,
  name,
  slug,
  index,
  onSelect
}: {
  photos: string[];
  name: string;
  slug: string | null;
  index: number;
  onSelect: (i: number) => void;
}) {
  const heroSrc = photos[index] ?? null;

  return (
    <div>
      <div className="overflow-hidden rounded-3xl border border-border shadow-soft">
        <VenueVisual src={heroSrc} slug={slug} alt={name} w={1200} h={600} className="h-64 w-full md:h-96" />
      </div>

      {photos.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Venue photos">
          {photos.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => onSelect(i)}
              aria-pressed={i === index}
              aria-label={`Show photo ${i + 1} of ${photos.length}`}
              className={cn(
                "press h-16 w-24 shrink-0 overflow-hidden rounded-2xl border-2 transition-colors",
                i === index ? "border-primary ring-2 ring-primary/30" : "border-transparent opacity-70 hover:opacity-100"
              )}
            >
              <VenueVisual src={src} slug={slug} alt="" w={200} h={120} className="h-full w-full" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}