"use client";

import * as React from "react";
import Link from "next/link";
import { buttonVariants } from "@myslot/ui";
import { copy } from "@/lib/copy";
import { formatPrice, perMonth, periodTotal, type Billing, type Currency } from "@/lib/pricing";

const OTHER: Record<Currency, Currency> = { USD: "LKR", LKR: "USD" };

function Toggle<T extends string>({
  value,
  options,
  onChange,
  label
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-full border border-border bg-paper p-1 text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
            value === o.value ? "bg-primary text-white" : "text-ink-2 hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The plan price. Both currencies are always in the server HTML (the second one
 * as the secondary line); `initialCurrency` is picked on the server from the
 * visitor's country, and the toggles let anyone switch.
 */
export function PricingCard({ initialCurrency }: { initialCurrency: Currency }) {
  const p = copy.pricing;
  const [currency, setCurrency] = React.useState<Currency>(initialCurrency);
  const [billing, setBilling] = React.useState<Billing>("monthly");
  const other = OTHER[currency];

  return (
    <section className="mt-10 rounded-3xl border border-primary bg-primary-light p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Toggle
          label="Billing period"
          value={billing}
          onChange={setBilling}
          options={[
            { value: "monthly", label: p.monthlyLabel },
            { value: "annual", label: p.annualLabel }
          ]}
        />
        <Toggle
          label="Currency"
          value={currency}
          onChange={setCurrency}
          options={[
            { value: "LKR", label: "LKR" },
            { value: "USD", label: "USD" }
          ]}
        />
      </div>

      <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-primary">{p.planName}</p>
      <p className="mt-1 font-display text-5xl font-extrabold tracking-tight text-ink">
        {formatPrice(currency, perMonth(currency, billing))}
        <span className="ml-2 text-lg font-medium text-ink-2">/ month</span>
      </p>
      <p className="mt-2 text-sm text-ink-2">
        {billing === "annual"
          ? `Billed ${formatPrice(currency, periodTotal(currency, "annual"))} once a year`
          : "Billed monthly"}
        {" · "}
        {formatPrice(other, perMonth(other, billing))} / month
      </p>
      <p className="mt-3 text-ink-2">{p.planNote}</p>
      <Link href="/#inquire" className={`${buttonVariants({ variant: "primary", size: "lg" })} mt-6`}>
        {p.primaryCta}
      </Link>
      <p className="mt-3 text-xs text-ink-3">First 3 months free. No setup fees, no lock-in.</p>
    </section>
  );
}
