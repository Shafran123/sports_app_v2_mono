"use client";

import { buttonVariants } from "@myslot/ui";
import { copy } from "@/lib/copy";
import { trackCta } from "@/lib/analytics";

export function TrialBand() {
  return (
    <section className="rounded-3xl border border-primary bg-primary-light p-8 text-center">
      <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink">{copy.trialBand.title}</h2>
      <p className="mt-2 text-ink-2">{copy.trialBand.sub}</p>
      <a
        href="#inquire"
        className={buttonVariants({ variant: "primary", size: "lg" })}
        onClick={() => trackCta("trial-band")}
      >
        {copy.trialBand.cta}
      </a>
    </section>
  );
}