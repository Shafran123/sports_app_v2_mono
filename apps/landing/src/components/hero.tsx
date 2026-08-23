"use client";

import { buttonVariants, BrandLockup } from "@myslot/ui";
import { copy } from "@/lib/copy";
import { trackCta } from "@/lib/analytics";
import { useBrandName } from "@/hooks/use-brand-name";
import { RotatingHeadline } from "./rotating-headline";
import { ScrollCue } from "./scroll-cue";
import { TrackSection } from "./track-section";

export function Hero() {
  const brand = useBrandName();

  return (
    <section className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden border-b border-border bg-paper">
      <TrackSection name="hero" />
      <div className="mx-auto w-full max-w-5xl px-4 pb-10 pt-8 text-center">
        <p className="animate-fade-up font-display text-2xl font-extrabold tracking-tight text-ink">
          <BrandLockup brand={brand} />
        </p>
        <h1 className="mt-8 font-display text-ink">
          <span className="block animate-fade-up text-xl font-extrabold tracking-tight sm:text-2xl">
            {copy.hero.headlineLead}
          </span>
          <span
            className="animate-word-roll mt-2 block font-extrabold leading-tight tracking-tight text-5xl sm:text-8xl"
            style={{ animationDelay: "0.05s" }}
          >
            <RotatingHeadline />
          </span>
        </h1>
        <p className="animate-fade-up mx-auto mt-4 max-w-2xl text-base text-ink-2" style={{ animationDelay: "0.12s" }}>
          {copy.hero.body}
        </p>
        <div
          className="animate-pop-in mt-6 flex flex-wrap items-center justify-center gap-3"
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
        <p
          className="animate-fade-up mt-4 text-xs text-ink-3"
          style={{ animationDelay: "0.3s" }}
        >
          {copy.hero.finePrint}
        </p>
      </div>

      <ScrollCue />
    </section>
  );
}