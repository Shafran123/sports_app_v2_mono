"use client";

import * as React from "react";
import { copy } from "@/lib/copy";

const ROTATE_MS = 3000;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Rotates a single one-word USP in the hero headline, like ClassPass.
 * Reduced-motion users see the first word statically; screen readers get
 * the full list via sr-only text (the visible word is aria-hidden).
 */
export function RotatingHeadline() {
  const list = copy.hero.usps;
  const count = list.length;
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (prefersReducedMotion() || count <= 1) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [count]);

  return (
    <>
      <span className="sr-only">{list.join(". ")}.</span>
      <span key={index} aria-hidden="true" className="animate-word-roll inline-block text-primary">
        {list[index]}
      </span>
    </>
  );
}