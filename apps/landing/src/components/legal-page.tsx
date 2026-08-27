import Link from "next/link";
import { contact, copy } from "@/lib/copy";

type LegalKind = "privacy" | "terms";

export function LegalPage({ kind }: { kind: LegalKind }) {
  const legal = copy.legal[kind];
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/" className="text-sm font-medium text-primary transition-colors hover:underline">
        ← Back to home
      </Link>
      <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-ink md:text-4xl">{legal.title}</h1>
      <p className="mt-2 text-sm text-ink-3">{legal.lastUpdated}</p>
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-ink-2">
        {legal.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
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