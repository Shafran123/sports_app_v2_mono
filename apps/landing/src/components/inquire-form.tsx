"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { leads, toApiFailure } from "@myslot/api";
import { Button, Card, Input, Textarea } from "@myslot/ui";
import { copy } from "@/lib/copy";
import { trackEvent } from "@/lib/analytics";

export function InquireForm() {
  const [form, setForm] = React.useState({ name: "", email: "", phone: "", venue_name: "", city: "", message: "" });
  const [error, setError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);

  const submit = useMutation({
    mutationFn: () =>
      leads.submit({
        name: form.name,
        email: form.email,
        phone: form.phone.trim() || undefined,
        venue_name: form.venue_name.trim() || undefined,
        city: form.city.trim() || undefined,
        message: form.message.trim() || undefined
      }),
    onSuccess: () => {
      setSubmitted(true);
      trackEvent("inquire_submit");
    },
    onError: (e) => setError(toApiFailure(e)?.message ?? copy.inquire.errorGeneric)
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  if (submitted) {
    return (
      <Card className="p-8">
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink">{copy.inquire.successTitle}</h2>
        <p className="mt-2 text-ink-2">{copy.inquire.successBody}</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.name.trim() || !form.email.trim()) return;
          setError(null);
          submit.mutate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="lead-name" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
              {copy.inquire.fields.name} *
            </label>
            <Input id="lead-name" value={form.name} onChange={set("name")} placeholder={copy.inquire.fields.namePlaceholder} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="lead-email" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
              {copy.inquire.fields.email} *
            </label>
            <Input id="lead-email" type="email" value={form.email} onChange={set("email")} placeholder={copy.inquire.fields.emailPlaceholder} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="lead-phone" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
              {copy.inquire.fields.phone}
            </label>
            <Input id="lead-phone" type="tel" value={form.phone} onChange={set("phone")} placeholder={copy.inquire.fields.phonePlaceholder} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="lead-venue" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
              {copy.inquire.fields.venueName}
            </label>
            <Input id="lead-venue" value={form.venue_name} onChange={set("venue_name")} placeholder={copy.inquire.fields.venueNamePlaceholder} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="lead-city" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
              {copy.inquire.fields.city}
            </label>
            <Input id="lead-city" value={form.city} onChange={set("city")} placeholder={copy.inquire.fields.cityPlaceholder} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="lead-message" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
              {copy.inquire.fields.message}
            </label>
            <Textarea id="lead-message" rows={3} value={form.message} onChange={set("message")} placeholder={copy.inquire.fields.messagePlaceholder} />
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-error-light p-3 text-sm text-error">
            {error}
          </p>
        )}

        <div className="mt-6">
          <Button
            type="submit"
            size="lg"
            loading={submit.isPending}
            disabled={!form.name.trim() || !form.email.trim() || submit.isPending}
          >
            {submit.isPending ? copy.inquire.submitting : copy.inquire.submit}
          </Button>
        </div>
      </form>
    </Card>
  );
}