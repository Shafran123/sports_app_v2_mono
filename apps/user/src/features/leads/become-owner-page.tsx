"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { leads, toApiFailure } from "@myslot/api";
import { Button, Card, Input, Textarea } from "@myslot/ui";

export function BecomeOwnerPage() {
  const [form, setForm] = React.useState({ name: "", email: "", phone: "", venue_name: "", city: "", message: "" });
  const [error, setError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);

  const submit = useMutation({
    mutationFn: () => leads.submit({ ...form, phone: form.phone || undefined, venue_name: form.venue_name || undefined, city: form.city || undefined, message: form.message || undefined }),
    onSuccess: () => setSubmitted(true),
    onError: (e) => setError(toApiFailure(e)?.message ?? "Could not submit your details. Please try again.")
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  if (submitted) {
    return (
      <main className="mx-auto max-w-2xl space-y-6 px-4 pb-24 pt-16">
        <Card className="p-8">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Thank you — we&apos;ll be in touch</h1>
          <p className="mt-2 text-ink-2">
            Your details are with our team. Someone will reach out shortly to talk through listing your venue and setting up your plan.
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 pb-24 pt-8">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">List your place</h1>
        <p className="mt-1 text-sm text-ink-2">
          Tell us about your venue. Fill in the form and the team will contact you to set up your account and plan.
        </p>
      </div>

      <Card className="p-6">
        <div className="mt-1 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="lead-name" className="text-xs font-semibold uppercase tracking-wide text-ink-3">Name *</label>
            <Input id="lead-name" value={form.name} onChange={set("name")} placeholder="Your full name" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="lead-email" className="text-xs font-semibold uppercase tracking-wide text-ink-3">Email *</label>
            <Input id="lead-email" type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="lead-phone" className="text-xs font-semibold uppercase tracking-wide text-ink-3">Phone</label>
            <Input id="lead-phone" type="tel" value={form.phone} onChange={set("phone")} placeholder="07X XXX XXXX" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="lead-venue-name" className="text-xs font-semibold uppercase tracking-wide text-ink-3">Venue name</label>
            <Input id="lead-venue-name" value={form.venue_name} onChange={set("venue_name")} placeholder="e.g. Smash Arena" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="lead-city" className="text-xs font-semibold uppercase tracking-wide text-ink-3">City</label>
            <Input id="lead-city" value={form.city} onChange={set("city")} placeholder="e.g. Colombo" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="lead-message" className="text-xs font-semibold uppercase tracking-wide text-ink-3">Message</label>
            <Textarea id="lead-message" rows={3} value={form.message} onChange={set("message")} placeholder="Anything we should know?" />
          </div>
        </div>

        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-error">{error}</p>}

        <div className="mt-6">
          <Button onClick={() => submit.mutate()} disabled={submit.isPending || !form.name.trim() || !form.email.trim()}>
            {submit.isPending ? "Submitting…" : "Submit"}
          </Button>
        </div>
      </Card>
    </main>
  );
}