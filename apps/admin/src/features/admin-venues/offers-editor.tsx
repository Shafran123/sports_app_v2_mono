"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { business, toApiFailure } from "@myslot/api";
import { Badge, Button, Card, Checkbox, EmptyState, ErrorState, Input, SelectSheet, Skeleton } from "@myslot/ui";
import { dayName } from "@myslot/utils";
import { Plus, Trash2 } from "lucide-react";
import type { Offer } from "@myslot/types";

interface Court {
  id: string;
  name: string;
}

interface OfferDraft {
  kind: "venue" | "slot";
  discount_type: "percent" | "flat";
  percent: string;
  flat_amount: string;
  start_date: string;
  end_date: string;
  scopes: string[];
  window_day: string;
  window_start: string;
  window_end: string;
}

const blank = (): OfferDraft => ({
  kind: "venue",
  discount_type: "percent",
  percent: "",
  flat_amount: "",
  start_date: "",
  end_date: "",
  scopes: [],
  window_day: "",
  window_start: "",
  window_end: ""
});

function offerLabel(o: Offer): string {
  if (o.discount_type === "percent") return `${o.percent ?? 0}% off`;
  return `${o.flat_amount ?? 0} LKR off`;
}

export function OffersEditor({ venueId, venueCourts }: { venueId: string; venueCourts: Court[] }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<OfferDraft>(blank());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);

  const query = useQuery({
    queryKey: ["venue-offers", venueId],
    queryFn: () => business.listOffers(venueId)
  });

  const offers = query.data ?? [];

  const toggleScope = (courtId: string) => {
    setDraft((prev) => ({
      ...prev,
      scopes: prev.scopes.includes(courtId)
        ? prev.scopes.filter((id) => id !== courtId)
        : [...prev.scopes, courtId]
    }));
  };

  const create = useMutation({
    mutationFn: () =>
      business.createOffer(venueId, {
        kind: draft.kind,
        discount_type: draft.discount_type,
        percent: draft.discount_type === "percent" ? Number(draft.percent) : undefined,
        flat_amount: draft.discount_type === "flat" ? Number(draft.flat_amount) : undefined,
        start_date: draft.start_date || undefined,
        end_date: draft.end_date || undefined,
        scopes: draft.scopes.length ? draft.scopes : undefined,
        windows:
          draft.kind === "slot" && (draft.window_start || draft.window_end)
            ? [
                {
                  day_of_week: draft.window_day === "" ? null : Number(draft.window_day),
                  start_time: draft.window_start,
                  end_time: draft.window_end
                }
              ]
            : undefined
      }),
    onSuccess: () => {
      setDraft(blank());
      setNotice("Offer created.");
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["venue-offers", venueId] });
    },
    onError: (err) => {
      setError(toApiFailure(err).message);
      setNotice("");
    }
  });

  const toggleActive = useMutation({
    mutationFn: (o: Offer) => business.updateOffer(o.id, { is_active: !o.is_active }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["venue-offers", venueId] });
    },
    onError: (err) => {
      setError(toApiFailure(err).message);
    }
  });

  const remove = useMutation({
    mutationFn: (id: string) => business.deleteOffer(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["venue-offers", venueId] });
    },
    onError: (err) => {
      setError(toApiFailure(err).message);
    }
  });

  const submit = () => {
    setCreating(true);
    create.mutate(undefined, { onSettled: () => setCreating(false) });
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">Create an offer</h2>
        <p className="mt-0.5 text-xs text-ink-3">
          Offers are auto-applied server-side at checkout. Venue-wide discounts apply to the whole booking; slot offers
          discount each matching slot. The best offer of each kind applies — they never compound.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-2">Kind</span>
            <SelectSheet
              value={draft.kind}
              onChange={(e) => setDraft({ ...draft, kind: e.target.value as "venue" | "slot" })}
            >
              <option value="venue">Venue-wide (whole booking)</option>
              <option value="slot">Slot-based (per slot)</option>
            </SelectSheet>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-2">Discount type</span>
            <SelectSheet
              value={draft.discount_type}
              onChange={(e) => setDraft({ ...draft, discount_type: e.target.value as "percent" | "flat" })}
            >
              <option value="percent">Percentage</option>
              <option value="flat">Flat amount (LKR)</option>
            </SelectSheet>
          </label>
          {draft.discount_type === "percent" ? (
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-2">Percent off</span>
              <Input
                type="number"
                min={0}
                max={100}
                value={draft.percent}
                onChange={(e) => setDraft({ ...draft, percent: e.target.value })}
                placeholder="20"
              />
            </label>
          ) : (
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-2">Flat amount (LKR)</span>
              <Input
                type="number"
                min={0}
                value={draft.flat_amount}
                onChange={(e) => setDraft({ ...draft, flat_amount: e.target.value })}
                placeholder="500"
              />
            </label>
          )}
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-2">Start date (optional)</span>
            <Input type="date" value={draft.start_date} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-2">End date (optional)</span>
            <Input type="date" value={draft.end_date} onChange={(e) => setDraft({ ...draft, end_date: e.target.value })} />
          </label>
        </div>

        {draft.kind === "slot" && (
          <div className="mt-4 rounded-2xl bg-surface-2/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Slot offer scope</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {venueCourts.map((c) => (
                <label key={c.id} className="flex items-center gap-1.5 text-sm text-ink">
                  <Checkbox checked={draft.scopes.includes(c.id)} onChange={() => toggleScope(c.id)} />
                  {c.name}
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SelectSheet
                value={draft.window_day}
                onChange={(e) => setDraft({ ...draft, window_day: e.target.value })}
                aria-label="Day"
                className="w-40"
              >
                <option value="">Any day</option>
                {Array.from({ length: 7 }, (_, i) => (
                  <option key={i} value={i}>
                    {dayName(i)}
                  </option>
                ))}
              </SelectSheet>
              <Input
                type="time"
                aria-label="Window start"
                value={draft.window_start}
                onChange={(e) => setDraft({ ...draft, window_start: e.target.value })}
                className="w-32"
              />
              <Input
                type="time"
                aria-label="Window end"
                value={draft.window_end}
                onChange={(e) => setDraft({ ...draft, window_end: e.target.value })}
                className="w-32"
              />
            </div>
          </div>
        )}

        {error && <p className="mt-3 rounded-lg bg-error-light px-3 py-2 text-sm text-error">{error}</p>}
        {notice && <p className="mt-3 rounded-lg bg-success-light px-3 py-2 text-sm text-success">{notice}</p>}
        <div className="mt-4 flex justify-end">
          <Button onClick={submit} loading={creating}>
            <Plus className="h-4 w-4" /> Create offer
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold tracking-tight text-ink">Active offers</h3>
        <div className="mt-3">
          {query.isLoading ? (
            <Skeleton className="h-16 w-full rounded-2xl" />
          ) : query.isError ? (
            <ErrorState title="Could not load offers" onRetry={() => query.refetch()} />
          ) : offers.length === 0 ? (
            <EmptyState title="No offers yet" message="Create an offer to start discounting bookings." />
          ) : (
            <ul className="space-y-2">
              {offers.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {o.kind === "venue" ? "Venue-wide" : "Slot-based"} · {offerLabel(o)}
                    </p>
                    <p className="truncate text-xs text-ink-2">
                      {o.start_date || o.end_date
                        ? `${o.start_date ?? "—"} → ${o.end_date ?? "—"}`
                        : "No date limit"}
                      {o.kind === "slot" && o.scopes && o.scopes.length > 0
                        ? ` · ${o.scopes.length} court${o.scopes.length > 1 ? "s" : ""}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={o.is_active ? "success" : "neutral"}>{o.is_active ? "Active" : "Paused"}</Badge>
                    <button
                      type="button"
                      onClick={() => toggleActive.mutate(o)}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      {o.is_active ? "Pause" : "Activate"}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove.mutate(o.id)}
                      aria-label="Delete offer"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-error-light hover:text-error"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}