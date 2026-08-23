"use client";

import { copy } from "@/lib/copy";
import { Nav } from "./nav";
import { Hero } from "./hero";
import { HowItWorks } from "./how-it-works";
import { FeatureSection } from "./features/section";
import { TrialBand } from "./trial-band";
import { InquireForm } from "./inquire-form";
import { Footer } from "./footer";
import { TrackSection } from "./track-section";

export function LandingPage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <Nav />
      <Hero />
      <HowItWorks />

      <section id="features" className="py-20">
        <TrackSection name="features" />
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">{copy.features.eyebrow}</p>
          <h2 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink">{copy.features.title}</h2>
          <p className="mt-3 text-lg text-ink-2">{copy.features.subtitle}</p>
          <div className="mt-8 space-y-16">
            {copy.features.items.map((feature, i) => (
              <FeatureSection key={feature.id} feature={feature} flip={i % 2 === 1} />
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <TrackSection name="trial-band" />
        <TrialBand />
      </div>

      <section id="inquire" className="py-20">
        <TrackSection name="inquire" />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-[1fr_420px]">
          <div className="min-w-0 space-y-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">{copy.inquire.eyebrow}</p>
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink">{copy.inquire.title}</h2>
            <p className="text-lg text-ink-2">{copy.inquire.body}</p>
          </div>
          <div className="min-w-0">
            <InquireForm />
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}