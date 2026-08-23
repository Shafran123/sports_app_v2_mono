"use client";

import { buttonVariants } from "@myslot/ui";
import { copy } from "@/lib/copy";
import { trackCta } from "@/lib/analytics";
import { DeviceFrame } from "./device-frame";
import { MockExplore } from "./features/mockups";
import { TrackSection } from "./track-section";

export function Hero() {
  return (
    <section className="overflow-hidden border-b border-border bg-paper">
      <TrackSection name="hero" />
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-16 lg:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">{copy.hero.eyebrow}</p>
          <h1 className="animate-fade-up font-display text-4xl font-extrabold leading-tight tracking-tight text-ink md:text-5xl">
            {copy.hero.headline}
          </h1>
          <p className="mt-3 text-lg text-ink-2">{copy.hero.body}</p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="#inquire"
              className={buttonVariants({ variant: "primary", size: "lg" })}
              onClick={() => trackCta("hero")}
            >
              {copy.hero.primaryCta}
            </a>
            <a href="#how-it-works" className={buttonVariants({ variant: "ghost", size: "lg" })}>
              {copy.hero.secondaryCta}
            </a>
          </div>
        </div>
        <div className="min-w-0">
          <DeviceFrame shotId="hero-player" className="animate-fade-in">
            <MockExplore />
          </DeviceFrame>
        </div>
      </div>
    </section>
  );
}