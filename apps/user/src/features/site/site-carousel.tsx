"use client";

// The site hero gallery (ADR-0032 + revamp): auto-rotating slide set that
// accepts an optional persistent overlay (the Business name / headline / CTA
// on the site home). Autoplay pauses on hover and focus, stops while the tab
// is hidden, and never runs for users who prefer reduced motion. Slides keep
// their caption as a compact pill (top-right) so it never collides with the
// brand overlay. Render all slides in a translated track so swiping is cheap
// and images preload.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type CarouselSlide = { src: string; caption?: string };

const AUTOPLAY_MS = 5000;

export function SiteCarousel({
  slides,
  alt,
  overlay,
  className = ""
}: {
  slides: CarouselSlide[];
  alt: string;
  overlay?: ReactNode;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  }, []);

  useEffect(() => {
    if (slides.length <= 1 || paused || reduced.current) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [slides.length, paused]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setPaused(true);
      else setPaused(false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const go = (dir: 1 | -1) => setIndex((i) => (i + dir + slides.length) % slides.length);
  const count = slides.length;

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={alt}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const delta = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
        touchX.current = null;
        if (delta > 40) go(-1);
        else if (delta < -40) go(1);
      }}
      className={className}
    >
      <div className="relative h-full w-full overflow-hidden">
        <div className="flex h-full w-full" style={{ transform: `translateX(-${index * 100}%)`, transition: "transform 500ms ease" }}>
          {slides.map((slide, i) => (
            <div key={`${slide.src}-${i}`} className="relative h-full w-full shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slide.src}
                alt={slide.caption ?? `${alt} — photo ${i + 1}`}
                className="block h-full w-full object-cover"
                loading={i === 0 ? "eager" : "lazy"}
              />
              {slide.caption ? (
                <span className="absolute right-3 top-3 max-w-[70%] rounded-full bg-ink/55 px-3 py-1 text-xs font-medium text-white backdrop-blur md:right-5 md:top-5">
                  {slide.caption}
                </span>
              ) : null}
            </div>
          ))}
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous slide"
              onClick={() => go(-1)}
              className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-ink/40 text-white backdrop-blur transition-colors hover:bg-ink/70 md:flex"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={() => go(1)}
              className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-ink/40 text-white backdrop-blur transition-colors hover:bg-ink/70 md:flex"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to slide ${i + 1}`}
                  aria-current={i === index}
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/60 hover:bg-white"}`}
                />
              ))}
            </div>
          </>
        )}

        {overlay ? (
          <div className="pointer-events-none absolute inset-0">
            {/* Top scrim: keeps a transparent nav (stacked over the hero)
                readable on any slide. */}
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-ink/75 via-ink/35 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-ink/80 via-ink/30 to-transparent">
              <div className="pointer-events-auto max-w-6xl px-4 pb-10 md:px-6 md:pb-14">{overlay}</div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}