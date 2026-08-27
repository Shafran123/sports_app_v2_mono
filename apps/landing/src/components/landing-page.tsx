"use client";

import { contact, copy } from "@/lib/copy";
import { Hero } from "./hero";
import { HowItWorks } from "./how-it-works";
import { FeatureSection } from "./features/section";
import { TrialBand } from "./trial-band";
import { Capabilities } from "./capabilities";
import { Faq } from "./faq";
import { InquireForm } from "./inquire-form";
import { Footer } from "./footer";
import { TrackSection } from "./track-section";
import { Reveal } from "./reveal";

export function LandingPage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
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

      <Reveal>
        <Capabilities />
      </Reveal>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <TrackSection name="trial-band" />
        <Reveal>
          <TrialBand />
        </Reveal>
      </div>

      <Reveal>
        <Faq />
      </Reveal>

      <section id="inquire" className="py-20">
        <TrackSection name="inquire" />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-[1fr_420px]">
          <Reveal className="min-w-0 space-y-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">{copy.inquire.eyebrow}</p>
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink">{copy.inquire.title}</h2>
            <p className="text-lg text-ink-2">{copy.inquire.body}</p>
            <div className="space-y-2 pt-2 text-sm text-ink-2">
              <p className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {contact.address}
              </p>
              <p className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <a href={`tel:${contact.phoneHref}`} className="font-medium text-ink transition-colors hover:text-primary">
                  {contact.phone}
                </a>
              </p>
              <p className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <a href={`mailto:${contact.email}`} className="font-medium text-ink transition-colors hover:text-primary">
                  {contact.email}
                </a>
              </p>
            </div>
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