import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@myslot/ui";
import { contact, copy } from "@/lib/copy";

export const metadata: Metadata = {
  title: copy.pricing.metaTitle,
  description: copy.pricing.metaDescription,
  alternates: { canonical: "/pricing" }
};

export default function PricingPage() {
  const p = copy.pricing;
  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-4xl px-4 py-16">
        <Link href="/" className="text-sm font-medium text-primary transition-colors hover:underline">
          ← Back to home
        </Link>
        <p className="mt-8 text-sm font-semibold uppercase tracking-wide text-primary">{p.eyebrow}</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink md:text-5xl">{p.title}</h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-2">{p.sub}</p>
        <Link href="/#inquire" className={`${buttonVariants({ variant: "primary", size: "lg" })} mt-6`}>
          {p.primaryCta}
        </Link>

        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {p.steps.map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-border bg-surface p-6">
              <span className="text-sm font-semibold text-primary">Step {i + 1}</span>
              <h2 className="mt-1 font-display text-xl font-extrabold tracking-tight text-ink">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{step.body}</p>
            </li>
          ))}
        </ol>

        <section className="mt-14">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink">{p.includedTitle}</h2>
          <ul className="mt-4 grid gap-2 text-sm text-ink-2 sm:grid-cols-2">
            {p.included.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden="true" className="text-primary">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14 rounded-2xl border border-border bg-surface p-6">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink">{p.moneyTitle}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">{p.moneyBody}</p>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink">{p.faqTitle}</h2>
          <div className="mt-4 space-y-3">
            {p.faq.map((item) => (
              <details key={item.q} className="group rounded-2xl border border-border bg-surface p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-base font-extrabold tracking-tight text-ink">
                  {item.q}
                  <span aria-hidden="true" className="shrink-0 text-primary transition-transform duration-200 group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-ink-2">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-3xl border border-primary bg-primary-light p-8 text-center">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink">{p.ctaTitle}</h2>
          <p className="mx-auto mt-2 max-w-xl text-ink-2">{p.ctaBody}</p>
          <Link href="/#inquire" className={`${buttonVariants({ variant: "primary", size: "lg" })} mt-5`}>
            {p.primaryCta}
          </Link>
          <p className="mt-4 text-sm text-ink-2">
            Or reach us at{" "}
            <a href={`mailto:${contact.email}`} className="font-medium text-primary hover:underline">{contact.email}</a>{" "}
            · <a href={`tel:${contact.phoneHref}`} className="font-medium text-primary hover:underline">{contact.phone}</a>
          </p>
        </section>
      </div>
    </main>
  );
}
