"use client";

import { Card } from "@myslot/ui";
import { copy } from "@/lib/copy";
import { TrackSection } from "./track-section";

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-surface-2">
      <TrackSection name="how-it-works" />
      <div className="mx-auto max-w-6xl px-4 py-20">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">{copy.howItWorks.eyebrow}</p>
        <h2 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink">{copy.howItWorks.title}</h2>
        <div className="mt-6 grid gap-8 md:grid-cols-3">
          {copy.howItWorks.steps.map((step, i) => (
            <Card key={step.title} className="p-6">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-primary font-display text-sm font-extrabold">
                {i + 1}
              </span>
              <h3 className="mt-3 font-display text-lg font-extrabold tracking-tight text-ink">{step.title}</h3>
              <p className="mt-1.5 text-sm text-ink-2">{step.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}