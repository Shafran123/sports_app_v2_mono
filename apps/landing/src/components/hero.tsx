"use client";

import { buttonVariants } from "@myslot/ui";
import { copy } from "@/lib/copy";
import { trackCta } from "@/lib/analytics";
import { DeviceFrame } from "./device-frame";
import { MockExplore } from "./features/mockups";
import { RotatingUsps } from "./rotating-usps";
import { ScrollCue } from "./scroll-cue";
import { TrackSection } from "./track-section";

export function Hero() {
  return (
    <section className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden border-b border-border bg-paper">
      <TrackSection name="hero" />
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-28 pt-20 lg:grid-cols-2">
        <div className="min-w-0 space-y-6 text-center lg:text-left">
          <p className="animate-fade-up text-sm font-semibold uppercase tracking-wide text-primary">
            {copy.hero.eyebrow}
          </p>
          <h1
            className="animate-word-roll font-display text-4xl font-extrabold leading-tight tracking-tight text-ink md:text-5xl"
            style={{ animationDelay: "0.05s" }}
          >
            {copy.hero.headline}
          </h1>
          <p className="animate-fade-up mt-3 text-lg text-ink-2" style={{ animationDelay: "0.12s" }}>
            {copy.hero.body}
          </p>
          <div className="animate-fade-up" style={{ animationDelay: "0.18s" }}>
            <RotatingUsps />
          </div>
          <div className="animate-pop-in flex flex-wrap items-center justify-center gap-3 lg:justify-start" style={{ animationDelay: "0.24s" }}>
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
        <div className="animate-fade-up min-w-0" style={{ animationDelay: "0.32s" }}>
          <DeviceFrame shotId="hero-player" className="animate-float rotate-[-2deg]">
            <MockExplore />
          </DeviceFrame>
        </div>
      </div>

      <ScrollCue />
    </section>
  );
}