"use client";

import { copy } from "@/lib/copy";
import { Hero } from "./hero";
import { Nav } from "./nav";
import { HowItWorks } from "./how-it-works";
import { FeatureSection } from "./features/section";
import { TrialBand } from "./trial-band";
import { InquireForm } from "./inquire-form";
import { Footer } from "./footer";
import { TrackSection } from "./track-section";
import { Reveal } from "./reveal";

export function LandingPage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <Nav />
      <Hero />

      <Reveal>
        <HowItWorks />
      </Reveal>

      <section id="features" className="py-20">
        <TrackSection name="features" />
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">{copy.features.eyebrow}</p>
          <h2 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink">{copy.features.title}</h2>
          <p className="mt-3 text-lg text-ink-2">{copy.features.subtitle}</p>
          <div className="mt-8 space-y-16">
            {copy.features.items.map((feature, i) => (
              <Reveal key={feature.id}>
                <FeatureSection feature={feature} flip={i % 2 === 1} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <TrackSection name="trial-band" />
        <Reveal>
          <TrialBand />
        </Reveal>
      </div>

      <section id="player-features" className="py-20">
        <TrackSection name="player-features" />
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">{copy.playerFeatures.eyebrow}</p>
          <h2 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink">{copy.playerFeatures.title}</h2>
          <div className="mt-8 space-y-16">
            {copy.playerFeatures.items.map((feature, i) => (
              <Reveal key={feature.id}>
                <FeatureSection feature={feature} flip={i % 2 === 1} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="inquire" className="py-20">
        <TrackSection name="inquire" />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-[1fr_420px]">
          <Reveal className="min-w-0 space-y-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">{copy.inquire.eyebrow}</p>
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink">{copy.inquire.title}</h2>
            <p className="text-lg text-ink-2">{copy.inquire.body}</p>
          </Reveal>
          <Reveal className="min-w-0" delay={120}>
            <InquireForm />
          </Reveal>
        </div>
      </section>

      <Reveal>
        <Footer />
      </Reveal>
    </main>
  );
}