"use client";

import { buttonVariants } from "@myslot/ui";
import { copy } from "@/lib/copy";
import { trackCta } from "@/lib/analytics";
import { RotatingHeadline } from "./rotating-headline";
import { RotatingUsps } from "./rotating-usps";
import { ScrollCue } from "./scroll-cue";
import { TrackSection } from "./track-section";

export function Hero() {
  return (
    <section className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden border-b border-border bg-paper">
      <TrackSection name="hero" />
      <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-20 text-center">
        <p className="animate-fade-up text-sm font-semibold uppercase tracking-wide text-primary">
          {copy.hero.eyebrow}
        </p>
        <h1
          className="animate-word-roll mt-2 font-display text-4xl font-extrabold leading-tight tracking-tight text-ink md:text-6xl"
          style={{ animationDelay: "0.05s" }}
        >
          {copy.hero.headlinePrefix} <RotatingHeadline />
        </h1>
        <p className="animate-fade-up mt-4 text-lg text-ink-2" style={{ animationDelay: "0.12s" }}>
          {copy.hero.body}
        </p>
        <div className="animate-fade-up mt-3" style={{ animationDelay: "0.18s" }}>
          <RotatingUsps />
        </div>
        <div
          className="animate-pop-in mt-8 flex flex-wrap items-center justify-center gap-3"
          style={{ animationDelay: "0.24s" }}
        >
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

      <ScrollCue />
    </section>
  );
}