import type { VenueDetail } from "@myslot/types";
import { dayName, formatLkr } from "@myslot/utils";
import { prettyCity } from "@/lib/venue-seo";

/**
 * Server-rendered venue summary. VenueDetailPage loads its data on the client,
 * so its server HTML was a skeleton; this renders in its place while loading so
 * crawlers (and slow connections) get the venue's name, courts, prices and hours.
 */
export function VenueSeoSummary({ venue }: { venue: VenueDetail }) {
  const city = prettyCity(venue.city);
  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-8">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">{venue.name}</h1>
      <p className="mt-1 text-ink-2">{[venue.address, city].filter(Boolean).join(", ")}</p>
      {venue.sports.length > 0 && <p className="mt-1 text-sm text-ink-3">{venue.sports.map((s) => s.replace(/\b\w/g, (c) => c.toUpperCase())).join(" · ")}</p>}
      {venue.description && <p className="mt-4 text-ink-2">{venue.description}</p>}

      {venue.courts.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-extrabold text-ink">Courts and prices</h2>
          <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-surface">
            {venue.courts.map((court) => (
              <li key={court.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <span className="text-ink">
                  {court.name}
                  {court.sport ? ` · ${court.sport}` : ""}
                  {court.is_indoor ? " · Indoor" : ""}
                </span>
                <span className="text-ink-2">
                  {formatLkr(court.price_per_slot)} / {court.slot_duration_min} min
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {venue.hours.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-extrabold text-ink">Opening hours</h2>
          <ul className="mt-3 space-y-1 text-sm text-ink-2">
            {venue.hours.map((h) => (
              <li key={`${h.day_of_week}-${h.open_time}`}>
                {dayName(h.day_of_week)}: {h.open_time.slice(0, 5)} – {h.close_time.slice(0, 5)}
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="mt-8 text-sm text-ink-3">Loading live availability…</p>
    </main>
  );
}
