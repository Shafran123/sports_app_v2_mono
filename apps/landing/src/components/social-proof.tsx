"use client";

import { Card } from "@myslot/ui";
import { copy } from "@/lib/copy";
import { TrackSection } from "./track-section";

export function SocialProof() {
  return (
    <section className="border-y border-border bg-surface py-16">
      <TrackSection name="social-proof" />
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {copy.socialProof.stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl bg-paper p-6 text-center">
              <p className="font-display text-3xl font-extrabold text-ink">{stat.value}</p>
              <p className="mt-1 text-sm text-ink-2">{stat.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {copy.socialProof.testimonials.map((t) => (
            <Card key={t.author} className="p-6">
              <p className="text-ink-2">“{t.quote}”</p>
              <p className="mt-3 text-sm font-semibold text-ink">{t.author}</p>
              <p className="text-xs text-ink-3">{t.role}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}