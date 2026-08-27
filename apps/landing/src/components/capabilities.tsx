import { copy } from "@/lib/copy";
import { TrackSection } from "./track-section";

export function Capabilities() {
  return (
    <section id="what-you-get" className="bg-surface-2">
      <TrackSection name="capabilities" />
      <div className="mx-auto max-w-4xl px-4 py-20">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">{copy.capabilities.eyebrow}</p>
        <h2 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink">
          {copy.capabilities.title}
        </h2>
        <p className="mt-3 text-lg text-ink-2">{copy.capabilities.sub}</p>
        <div className="mt-10 overflow-hidden rounded-3xl border border-border bg-surface">
          <table className="w-full border-collapse text-left text-sm">
            <tbody>
              {copy.capabilities.items.map((item, i) => (
                <tr key={item.term} className={i % 2 === 1 ? "bg-paper" : "bg-surface"}>
                  <th
                    scope="row"
                    className="w-1/3 px-5 py-4 align-top font-display text-base font-extrabold tracking-tight text-ink md:px-6"
                  >
                    {item.term}
                  </th>
                  <td className="px-5 py-4 align-top text-ink-2 md:px-6">{item.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}