"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ToggleLeft, ToggleRight } from "lucide-react";
import { business, toApiFailure } from "@myslot/api";
import { Button, Card, Skeleton } from "@myslot/ui";
import type { BookingSettings } from "@myslot/types";

// Owner-facing Booking settings (ADR-0040), Business-level, as its own console
// page:
//  - Auto-confirm: on (default) = every booking confirms instantly; off = new
//    bookings land `pending` and the owner confirms them.
//  - Pending auto-cancel: hours before a pending booking's start after which
//    it auto-cancels (and refunds if it was paid online).
export function BookingSettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["booking-settings"],
    queryFn: () => business.getBookingSettings()
  });

  const [autoConfirm, setAutoConfirm] = React.useState(true);
  const [hours, setHours] = React.useState(4);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    if (data) {
      setAutoConfirm(data.auto_confirm);
      setHours(data.pending_auto_cancel_hours);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: (patch: Partial<BookingSettings>) => business.updateBookingSettings(patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-settings"] });
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (e) => setError(toApiFailure(e)?.message ?? "Could not save booking settings.")
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Booking settings</h1>
        <p className="mt-1 text-sm text-ink-2">
          How new bookings are confirmed, and how long an unconfirmed booking waits before it
          auto-cancels.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-3xl" />
      ) : isError || !data ? (
        <Card className="p-5 md:p-6">
          <p className="text-sm text-ink-2">Could not load booking settings.</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => refetch()}>
            Retry
          </Button>
        </Card>
      ) : (
        <SettingsBody
          data={data}
          autoConfirm={autoConfirm}
          setAutoConfirm={setAutoConfirm}
          hours={hours}
          setHours={setHours}
          error={error}
          saved={saved}
          save={save}
        />
      )}
    </div>
  );
}

function SettingsBody({
  data,
  autoConfirm,
  setAutoConfirm,
  hours,
  setHours,
  error,
  saved,
  save
}: {
  data: BookingSettings;
  autoConfirm: boolean;
  setAutoConfirm: (v: boolean) => void;
  hours: number;
  setHours: (v: number) => void;
  error: string | null;
  saved: boolean;
  save: { isPending: boolean; mutate: (patch: Partial<BookingSettings>) => void };
}) {
  const dirty = autoConfirm !== data.auto_confirm || hours !== data.pending_auto_cancel_hours;

  return (
    <Card className="p-5 md:p-6">
      <div className="mt-1 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-medium text-ink">Auto-confirm bookings</p>
            <p className="mt-0.5 max-w-lg text-sm text-ink-2">
              When on, bookings are confirmed the moment they&apos;re made (cash at booking, online when
              payment lands). When off, every new booking lands as{" "}
              <span className="font-semibold text-ink">pending</span> and you confirm each one from your
              console. A pending online-paid booking refunds in full if cancelled.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoConfirm}
            aria-label="Auto-confirm bookings"
            onClick={() => setAutoConfirm(!autoConfirm)}
            className="shrink-0 self-start"
          >
            {autoConfirm ? (
              <ToggleRight className="h-8 w-8 text-primary" />
            ) : (
              <ToggleLeft className="h-8 w-8 text-ink-3" />
            )}
          </button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-medium text-ink">Auto-cancel pending bookings</p>
            <p className="mt-0.5 max-w-lg text-sm text-ink-2">
              A booking still pending this many hours before its start is cancelled automatically, freeing
              the slot. If it was paid online, it&apos;s refunded in full.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              aria-label="Pending auto-cancel hours"
              type="number"
              min={1}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="w-24 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink"
            />
            <span className="text-sm text-ink-2">hours before start</span>
          </div>
        </div>
      </div>

      {error && <p className="mt-4 rounded-xl bg-error-light p-3 text-sm text-error">{error}</p>}
      <div className="mt-5 flex items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate({ auto_confirm: autoConfirm, pending_auto_cancel_hours: Math.max(1, hours) })}
        >
          {save.isPending ? "Saving…" : "Save booking settings"}
        </Button>
        {saved && <span className="text-sm text-success">Saved — applies to new bookings.</span>}
      </div>
    </Card>
  );
}
