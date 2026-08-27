import { copy } from "@/lib/copy";
import { TrackSection } from "./track-section";

export function Faq() {
  return (
    <section id="faq" className="bg-surface-2">
      <TrackSection name="faq" />
      <div className="mx-auto max-w-3xl px-4 py-20">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">{copy.faq.eyebrow}</p>
        <h2 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink">{copy.faq.title}</h2>
        <p className="mt-3 text-lg text-ink-2">{copy.faq.sub}</p>
        <div className="mt-8 space-y-3">
          {copy.faq.items.map((item) => (
            <details key={item.q} className="group rounded-2xl border border-border bg-surface p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-base font-extrabold tracking-tight text-ink">
                {item.q}
                <span aria-hidden="true" className="shrink-0 text-primary transition-transform duration-200 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-2">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}