import type { Metadata } from "next";
import Link from "next/link";
import { contact, copy } from "@/lib/copy";

export const metadata: Metadata = {
  title: "FAQ"
};

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/" className="text-sm font-medium text-primary transition-colors hover:underline">
        ← Back to home
      </Link>
      <p className="mt-8 text-sm font-semibold uppercase tracking-wide text-primary">{copy.faq.eyebrow}</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink md:text-4xl">{copy.faq.title}</h1>
      <p className="mt-3 text-lg text-ink-2">{copy.faq.sub}</p>
      <div className="mt-8 space-y-3">
        {copy.faq.items.map((item) => (
          <details key={item.q} className="group rounded-2xl border border-border bg-surface p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-base font-extrabold tracking-tight text-ink">
              {item.q}
              <span
                aria-hidden="true"
                className="shrink-0 text-primary transition-transform duration-200 group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-ink-2">{item.a}</p>
          </details>
        ))}
      </div>
      <div className="mt-10 rounded-2xl border border-border bg-surface p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{copy.legal.contactHeading}</p>
        <address className="mt-2 space-y-1 not-italic text-sm text-ink-2">
          <p>{contact.address}</p>
          <a href={`tel:${contact.phoneHref}`} className="block text-primary transition-colors hover:underline">
            {contact.phone}
          </a>
          <a href={`mailto:${contact.email}`} className="block text-primary transition-colors hover:underline">
            {contact.email}
          </a>
        </address>
      </div>
    </div>
  );
}