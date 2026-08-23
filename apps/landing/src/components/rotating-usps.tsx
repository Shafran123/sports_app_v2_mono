"use client";

import * as React from "react";
import { copy } from "@/lib/copy";

const ROTATE_MS = 3000;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Rotates through the hero USPs, one visible at a time, pausing on
 * hover/focus. Reduced-motion users see the first phrase statically;
 * screen readers get the full list via sr-only text.
 */
export function RotatingUsps() {
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  const list = copy.hero.usps;
  const count = list.length;

  React.useEffect(() => {
    if (prefersReducedMotion() || paused || count <= 1) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [paused, count]);

  return (
    <div
      className="relative min-h-[1.6em]"
      tabIndex={-1}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <ul className="sr-only">
        {list.map((usp) => (
          <li key={usp}>{usp}</li>
        ))}
      </ul>
      <p
        key={index}
        aria-hidden="true"
        className="animate-fade-up flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary"
      >
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />
        <span>{list[index]}</span>
      </p>
    </div>
  );
}