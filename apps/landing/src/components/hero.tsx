"use client";

import { buttonVariants } from "@myslot/ui";
import { copy } from "@/lib/copy";
import { trackCta } from "@/lib/analytics";
import { RotatingHeadline } from "./rotating-headline";
import { ScrollCue } from "./scroll-cue";
import { TrackSection } from "./track-section";

export function Hero() {
  return (
    <section className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden border-b border-border bg-paper">
      <TrackSection name="hero" />
      <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-20 text-center">
        <h1
          className="animate-word-roll font-display text-6xl font-extrabold leading-none tracking-tight text-ink md:text-8xl"
          style={{ animationDelay: "0.05s" }}
        >
          <RotatingHeadline />
        </h1>
        <p className="animate-fade-up mt-4 text-lg text-ink-2" style={{ animationDelay: "0.12s" }}>
          {copy.hero.body}
        </p>
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