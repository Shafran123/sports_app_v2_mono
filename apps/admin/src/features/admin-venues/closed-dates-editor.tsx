"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { business, toApiFailure } from "@myslot/api";
import { Button, Card, EmptyState, ErrorState, Input, Skeleton } from "@myslot/ui";
import { Plus, Trash2 } from "lucide-react";
import type { ClosedDate } from "@myslot/types";

export function ClosedDatesEditor({ venueId }: { venueId: string }) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const query = useQuery({
    queryKey: ["venue-closed-dates", venueId],
    queryFn: () => business.listClosedDates(venueId)
  });

  const add = useMutation({
    mutationFn: () => business.addClosedDate(venueId, { closed_date: date, reason: reason || undefined }),
    onSuccess: () => {
      setDate("");
      setReason("");
      setNotice("Closed date added.");
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["venue-closed-dates", venueId] });
    },
    onError: (err) => {
      setError(toApiFailure(err).message);
      setNotice("");
    }
  });

  const remove = useMutation({
    mutationFn: (d: string) => business.removeClosedDate(venueId, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["venue-closed-dates", venueId] });
    },
    onError: (err) => {
      setError(toApiFailure(err).message);
    }
  });

  const dates = query.data ?? [];

  return (
    <Card className="p-5">
      <div>
        <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">Closed dates</h2>
        <p className="mt-0.5 text-xs text-ink-3">
          Days the venue is closed (holidays, maintenance). Players can&apos;t book these. Existing bookings stay.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!date) return;
          add.mutate();
        }}
        className="mt-4 flex flex-wrap items-center gap-2"
      >
        <Input
          type="date"
          aria-label="Closed date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-44"
        />
        <Input
          aria-label="Reason (optional)"
          placeholder="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-56"
        />
        <Button type="submit" size="sm" loading={add.isPending} disabled={!date}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </form>

      {error && <p className="mt-3 rounded-lg bg-error-light px-3 py-2 text-sm text-error">{error}</p>}
      {notice && <p className="mt-3 rounded-lg bg-success-light px-3 py-2 text-sm text-success">{notice}</p>}

      <div className="mt-4">
        {query.isLoading ? (
          <Skeleton className="h-20 w-full rounded-2xl" />
        ) : query.isError ? (
          <ErrorState title="Could not load closed dates" onRetry={() => query.refetch()} />
        ) : dates.length === 0 ? (
          <EmptyState title="No closed dates" message="Your venue is open every day you have hours set." />
        ) : (
          <ul className="space-y-2">
            {dates.map((d: ClosedDate) => (
              <li
                key={d.closed_date}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{d.closed_date}</p>
                  {d.reason && <p className="truncate text-xs text-ink-2">{d.reason}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => remove.mutate(d.closed_date)}
                  aria-label={`Remove closed date ${d.closed_date}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-error-light hover:text-error"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}