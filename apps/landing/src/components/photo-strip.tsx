"use client";

import { copy } from "@/lib/copy";
import { TrackSection } from "./track-section";

export function PhotoStrip() {
  return (
    <section className="bg-surface-2 py-16">
      <TrackSection name="photo-strip" />
      <div className="mx-auto max-w-6xl px-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">{copy.photoStrip.eyebrow}</p>
        <h2 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink">{copy.photoStrip.title}</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {copy.photoStrip.photos.map((photo) => (
            <figure key={photo.src} className="overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.src} alt={photo.alt} className="aspect-[4/3] w-full object-cover" />
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}