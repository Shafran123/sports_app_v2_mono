"use client";

import * as React from "react";
import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock, MapPin, Plus, Users } from "lucide-react";
import { sports, venues, events as eventsApi, toApiFailure } from "@spots/api";
import type { Event } from "@spots/types";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  EmptyState,
  ErrorState,
  Input,
  Progress,
  Select,
  Skeleton,
  StatusPill,
  Textarea
} from "@spots/ui";
import { formatDateLong, formatLkr, formatTime12 } from "@spots/utils";
import { useToasts } from "./toasts";


type CreateEventPayload = {
  name: string;
  description?: string;
  city?: string;
  sport?: string;
  venue_id?: string;
  start_at: string;
  end_at?: string;
  capacity: number;
  price: number;
};


interface FormState {
  title: string;
  description: string;
  city: string;
  sport: string;
  venue_id: string;
  start_at: string;
  end_at: string;
  capacity: string;
  price: string;
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  city: "",
  sport: "",
  venue_id: "",
  start_at: "",
  end_at: "",
  capacity: "",
  price: ""
};

export function EventsManager() {
  const { push, viewport } = useToasts();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [eventsList, setEventsList] = useState<Event[]>([]);
  const [cancelFor, setCancelFor] = useState<Event | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["admin-console-events"],
    queryFn: () => eventsApi.list({ page: 1, limit: 50 })
  });

  const sportsQuery = useQuery({
    queryKey: ["sports"],
    queryFn: () => sports.list()
  });

  const venuesQuery = useQuery({
    queryKey: ["my-venues"],
    queryFn: () => venues.mine()
  });

  useEffect(() => {
    if (listQuery.data) setEventsList(listQuery.data);
  }, [listQuery.data]);

  const setField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.title.trim()) errs.title = "Enter a title.";
    if (!form.start_at) errs.start_at = "Pick a start time.";
    else if (Number.isNaN(new Date(form.start_at).getTime())) errs.start_at = "Enter a valid start time.";
    if (!form.end_at) errs.end_at = "Pick an end time.";
    else if (Number.isNaN(new Date(form.end_at).getTime())) errs.end_at = "Enter a valid end time.";
    else if (form.start_at && form.end_at <= form.start_at) errs.end_at = "End time must be after the start.";
    const capacity = Number(form.capacity);
    if (!form.capacity || Number.isNaN(capacity) || capacity <= 0) errs.capacity = "Enter a capacity above 0.";
    const price = Number(form.price);
    if (form.price === "" || Number.isNaN(price) || price < 0) errs.price = "Enter a price of 0 or more.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const createMutation = useMutation({
    mutationFn: (payload: CreateEventPayload) => eventsApi.create(payload),
    onSuccess: (event) => {
      setEventsList((prev) => [event, ...prev]);
      setForm(EMPTY_FORM);
      setSubmitError(null);
      push("success", "Event created", event.title);
    },
    onError: (error) => {
      const message = toApiFailure(error).message;
      setSubmitError(message);
      push("error", "Could not create event", message);
    }
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitError(null);
    createMutation.mutate({
      name: form.title.trim(),
      description: form.description.trim() || undefined,
      city: form.city.trim() || undefined,
      sport: form.sport || undefined,
      venue_id: form.venue_id || undefined,
      start_at: new Date(form.start_at).toISOString(),
      end_at: new Date(form.end_at).toISOString(),
      capacity: Number(form.capacity),
      price: Number(form.price)
    });
  };

  const cancelMutation = useMutation({
    mutationFn: (id: string) => eventsApi.cancel(id),
    onSuccess: (_data, id) => {
      setEventsList((prev) => prev.map((ev) => (ev.id === id ? { ...ev, status: "cancelled" } : ev)));
      setCancelFor(null);
      setCancelError(null);
      push("success", "Event cancelled", "Registered players have been refunded.");
    },
    onError: () => {
      setCancelError("We could not cancel this event. Please try again.");
      push("error", "Could not cancel event", "Please try again or reload the page.");
    }
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">Events</h1>
        <p className="mt-1 text-sm text-ink-2">Create one-off activities and manage registrations.</p>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[26rem_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl font-extrabold tracking-tight text-ink">
              Create an event
            </CardTitle>
            <CardDescription>Set up a one-off activity that players can register for.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <Field label="Title" error={fieldErrors.title}>
                <Input
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  placeholder="Saturday night badminton"
                  error={!!fieldErrors.title}
                />
              </Field>
              <Field label="Description">
                <Textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  placeholder="A friendly doubles session for all levels."
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="City">
                  <Input
                    value={form.city}
                    onChange={(e) => setField("city", e.target.value)}
                    placeholder="Colombo"
                  />
                </Field>
                <Field label="Sport">
                  <Select value={form.sport} onChange={(e) => setField("sport", e.target.value)}>
                    <option value="">None</option>
                    {sportsQuery.data?.map((s) => (
                      <option key={s.id} value={s.slug}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Venue">
                <Select value={form.venue_id} onChange={(e) => setField("venue_id", e.target.value)}>
                  <option value="">No venue</option>
                  {venuesQuery.data?.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Starts" error={fieldErrors.start_at}>
                  <Input
                    type="datetime-local"
                    value={form.start_at}
                    onChange={(e) => setField("start_at", e.target.value)}
                    error={!!fieldErrors.start_at}
                  />
                </Field>
                <Field label="Ends" error={fieldErrors.end_at}>
                  <Input
                    type="datetime-local"
                    value={form.end_at}
                    onChange={(e) => setField("end_at", e.target.value)}
                    error={!!fieldErrors.end_at}
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Capacity" error={fieldErrors.capacity}>
                  <Input
                    type="number"
                    min={1}
                    value={form.capacity}
                    onChange={(e) => setField("capacity", e.target.value)}
                    placeholder="24"
                    error={!!fieldErrors.capacity}
                  />
                </Field>
                <Field label="Price (LKR)" error={fieldErrors.price}>
                  <Input
                    type="number"
                    min={0}
                    value={form.price}
                    onChange={(e) => setField("price", e.target.value)}
                    placeholder="1500"
                    error={!!fieldErrors.price}
                  />
                </Field>
              </div>
              {submitError && <p className="text-sm text-error">{submitError}</p>}
              <Button type="submit" size="lg" loading={createMutation.isPending} className="w-full">
                <Plus className="h-4 w-4" /> Create event
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div>
            <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">All events</h2>
            <p className="mt-0.5 text-sm text-ink-2">Upcoming events with live registrations.</p>
          </div>

          {listQuery.isLoading ? (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <Card key={i} className="space-y-3 p-5">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-2 w-full" />
                </Card>
              ))}
            </div>
          ) : listQuery.isError ? (
            <ErrorState
              title="Could not load events"
              message="We could not fetch events right now."
              onRetry={() => listQuery.refetch()}
            />
          ) : eventsList.length === 0 ? (
            <EmptyState
              title="No events yet"
              message="No events yet — create the first one with the form on the left."
            />
          ) : (
            <div className="space-y-4">
              {eventsList.map((event) => {
                const capacity = Number(event.capacity) || 0;
                const registered = Number(event.registrations_count) || 0;
                const pct = capacity > 0 ? Math.round((registered / capacity) * 100) : 0;
                const full = capacity > 0 && registered >= capacity;
                return (
                  <Card key={event.id} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-semibold tracking-tight text-ink">{event.title}</h3>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
                          {event.sport_name && <span>{event.sport_name}</span>}
                          {event.venue_name && (
                            <span className="inline-flex min-w-0 items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{event.venue_name}</span>
                            </span>
                          )}
                          {event.city && (
                            <span className="text-ink-3">{"\u00b7"} {event.city}</span>
                          )}
                        </p>
                      </div>
                      <StatusPill status={event.status} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-4 w-4" /> {formatDateLong(event.start_at)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-4 w-4" /> {formatTime12(event.start_at)}
                        {event.end_at ? ` \u2013 ${formatTime12(event.end_at)}` : ""}
                      </span>
                    </div>
                    {capacity > 0 && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs text-ink-2">
                          <span className="inline-flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5" /> {registered}/{capacity} registered
                          </span>
                          <span>{pct}%</span>
                        </div>
                        <Progress
                          value={pct}
                          tone={full ? "error" : pct >= 75 ? "warning" : "primary"}
                          className="mt-1.5"
                        />
                      </div>
                    )}
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="font-display text-lg font-extrabold text-ink">
                        {event.price > 0 ? `${formatLkr(event.price)} / player` : "Free"}
                      </span>
                      {event.status !== "cancelled" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-error text-error hover:bg-error-light"
                          onClick={() => {
                            setCancelFor(event);
                            setCancelError(null);
                          }}
                        >
                          Cancel event
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!cancelFor} onOpenChange={(open) => !open && setCancelFor(null)}>
        {cancelFor && (
          <DialogContent
            title="Cancel this event?"
            description="Registered players will be refunded and notified. This cannot be undone."
            onClose={() => setCancelFor(null)}
          >
            <p className="text-sm text-ink-2">
              Are you sure you want to cancel{" "}
              <span className="font-semibold text-ink">{cancelFor.title}</span>?
            </p>
            {cancelError && <p className="mt-3 text-sm text-error">{cancelError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setCancelFor(null);
                  setCancelError(null);
                }}
              >
                Keep event
              </Button>
              <Button
                variant="destructive"
                loading={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate(cancelFor.id)}
              >
                Cancel event
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {viewport}
    </div>
  );
}

function Field({
  label,
  error,
  children
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-3">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-error">{error}</span>}
    </label>
  );
}