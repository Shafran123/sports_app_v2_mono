"use client";

import * as React from "react";
import { venueVisualSrc, sportGlyph } from "@spots/utils";
import { cn } from "@spots/utils";

export function VenueVisual({
  venue,
  src,
  slug,
  alt = "",
  w = 800,
  h = 500,
  className,
  glyphClass,
  fallbackGlyph
}: {
  venue?: { photos?: unknown; sports?: unknown[] } | null;
  src?: string | null;
  slug?: string | null;
  alt?: string;
  w?: number;
  h?: number;
  className?: string;
  glyphClass?: string;
  fallbackGlyph?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  const visualSrc = src ?? venueVisualSrc(venue, w, h);

  if (failed || !visualSrc) {
    return (
      <div
        role="img"
        aria-label={alt || undefined}
        className={cn(
          "flex items-center justify-center bg-gradient-to-br from-surface-2 via-surface to-primary-light",
          className
        )}
      >
        <span className={cn("drop-shadow", glyphClass ?? "text-4xl md:text-5xl")} aria-hidden="true">
          {fallbackGlyph ?? sportGlyph(slug)}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={visualSrc}
      alt={alt}
      width={w}
      height={h}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("object-cover", className)}
    />
  );
}