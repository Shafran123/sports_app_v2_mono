"use client";

// The Booking Widget's booking flow (ADR-0028, ticket 04): date + court +
// slots, a cash checkout, and a QR success screen that is also the terminal
// step online-payment redirects will later return to. Identity is unified:
// verified players skip the step, phone-only visitors verify first.
// Scoped per Widget Instance (ADR-0028 v1.5): instanceKey is sent on checkout
// so the server enforces the instance's venue scope; the branded page books
// without an instance key.

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as QRCode from "qrcode";
import { bookings, toApiFailure } from "@myslot/api";
import { Button, Card, ErrorState, Skeleton } from "@myslot/ui";
import { cn, dayjs, formatDuration, formatLkr, formatTime12, toDateKey, uuidV4 } from "@myslot/utils";
import type { CourtAvailability, Slot, WidgetConfig } from "@myslot/types";
import { useAuth } from "@/context/auth";
import { useAvailability } from "@/features/venue-detail/use-availability";
import { SlotPicker } from "@/features/venue-detail/slot-picker";
import {
  applyVenueOffer,
  durationChoices,
  longestAvailableRun,
  selectRun,
  summarizeSelection,
  type SelectedSlots
} from "@/features/venue-detail/selection";
import { WidgetIdentity } from "./widget-identity";

type Stage = "identity" | "pick" | "booked";

export function BookPanel({ venue, instanceKey }: { venue: WidgetConfig; instanceKey?: string }) {
  const { user } = useAuth();
  const [stage, setStage] = useState<Stage>("identity");
  const [date, setDate] = useState(() => toDateKey(new Date()));
  const [durationMin, setDurationMin] = useState(0);
  const [selected, setSelected] = useState<SelectedSlots>({});
  const [checkoutKey, setCheckoutKey] = useState(() => uuidV4());

  const verified = !!user?.phone_verified_at;

  useEffect(() => {
    if (stage === "identity" && verified) setStage("pick");
  }, [verified, stage]);

  const availabilityQuery = useAvailability(venue.id, date);
  const summary = summarizeSelection(selected, availabilityQuery.data);
  const venueOffer = availabilityQuery.data?.venue_offer ?? null;
  const displayTotal = useMemo(() => applyVenueOffer(summary.total, venueOffer).total, [summary.total, venueOffer]);

  const checkout = useMutation({
    mutationFn: () =>
      bookings.checkout({
        court_id: summary.courtId!,
        start_at: summary.startAt!,
        end_at: summary.endAt!,
        idempotency_key: checkoutKey,
        payment_method: "cash",
        player_phone: user?.phone ?? undefined,
        widget_instance_key: instanceKey
      })
  });

  const pickDate = (key: string) => {
    setDate(key);
    setSelected({});
    setDurationMin(0);
  };

  const handleConfirm = () => {
    if (checkout.isPending || checkout.data) return;
    checkout.mutate(undefined, {
      onSuccess: () => setStage("booked")
    });
  };

  if (stage === "identity") {
    return <WidgetIdentity widgetKey={instanceKey} onDone={() => setStage("pick")} />;
  }

  if (stage === "booked" && checkout.data?.booking) {
    return <BookingSuccess booking={checkout.data.booking} />;
  }

  const courts = availabilityQuery.data?.courts ?? [];
  const acceptsCash = !!venue.accepts_cash;

  return (
    <div className="space-y-4">
      {!acceptsCash && (
        <div className="rounded-2xl border border-warning/40 bg-warning-light px-4 py-3 text-sm text-warning">
          This venue doesn&apos;t accept pay-at-venue yet — online booking is coming soon.
        </div>
      )}

      <div>
        <h3 className="font-display text-lg font-extrabold tracking-tight text-ink">Book a slot</h3>
        <p className="mt-0.5 text-sm text-ink-2">
          Pick a date and duration, then confirm. Pay at the venue when you arrive.
        </p>
      </div>

      {checkout.error && (
        <p className="rounded-xl bg-error-light px-3 py-2 text-sm text-error">
          {toApiFailure(checkout.error).message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <label htmlFor="bp-date" className="text-xs font-medium text-ink-2">Date</label>
          <input
            id="bp-date"
            type="date"
            min={toDateKey(new Date())}
            max={venue.advance_days && venue.advance_days > 0 ? dayjs(toDateKey(new Date())).add(venue.advance_days - 1, "day").format("YYYY-MM-DD") : undefined}
            value={date}
            onChange={(e) => e.target.value && pickDate(e.target.value)}
            className="rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        {courts.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="bp-duration" className="text-xs font-medium text-ink-2">Duration</label>
            <select
              id="bp-duration"
              value={durationMin ? String(durationMin) : ""}
              onChange={(e) => {
                setDurationMin(Number(e.target.value));
                setSelected({});
              }}
              className="rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="">Select</option>
              {Array.from(new Set(courts.flatMap((c) => durationChoices(c, c.slots)))).sort((a, b) => a - b).map((min) => (
                <option key={min} value={min}>{formatDuration(min)}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {availabilityQuery.isLoading ? (
          <Skeleton className="h-24 w-full rounded-3xl" />
        ) : availabilityQuery.isError ? (
          <ErrorState title="Could not load availability" onRetry={() => availabilityQuery.refetch()} />
        ) : courts.length === 0 ? (
          <div className="rounded-3xl border border-border bg-surface p-6 text-center text-sm text-ink-3">
            This venue is closed on the selected day.
          </div>
        ) : (
          courts.map((court) => (
            <CourtCard
              key={court.court_id}
              court={court}
              date={date}
              advanceDays={venue.advance_days}
              durationMin={durationMin}
              selected={selected}
              onToggle={(slot) =>
                durationMin > 0 && setSelected((prev) => selectRun(prev, court, slot, durationMin))
              }
            />
          ))
        )}
      </div>

      {summary.count > 0 && (
        <div className="rounded-3xl border border-border bg-surface p-4 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-ink">{summary.courtName}</p>
              <p className="text-sm text-ink-2">
                {formatTime12(summary.startAt!)} – {formatTime12(summary.endAt!)} ·{" "}
                {dayjs(date, "YYYY-MM-DD").format("ddd, D MMM")}
              </p>
            </div>
            <p className="font-display text-xl font-extrabold tracking-tight text-ink">
              {formatLkr(displayTotal)}
            </p>
          </div>
          <Button className="mt-4 w-full" size="lg" disabled={!acceptsCash} loading={checkout.isPending} onClick={handleConfirm}>
            {checkout.isPending ? "Booking…" : "Confirm booking — pay at venue"}
          </Button>
        </div>
      )}
    </div>
  );
}

function CourtCard({
  court,
  date,
  advanceDays,
  durationMin,
  selected,
  onToggle
}: {
  court: CourtAvailability;
  date: string;
  advanceDays?: number;
  durationMin: number;
  selected: SelectedSlots;
  onToggle: (slot: Slot) => void;
}) {
  const available = court.slots.filter((s) => s.state === "available").length;
  const fullyBooked = available === 0;
  const maxFit = longestAvailableRun(court.slots) * court.slot_duration_min;
  const canFit = durationMin > 0 && durationMin <= maxFit;

  return (
    <Card className={cn("p-5", fullyBooked && "opacity-70")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="font-semibold tracking-tight text-ink">{court.name}</h4>
          <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-ink-3">
            {court.sport ?? "Court"} · {court.slot_duration_min} min slots
          </p>
        </div>
        <p className="font-display text-base font-extrabold text-ink">
          {fullyBooked ? (
            <span className="text-sm font-medium text-ink-3">Fully booked</span>
          ) : (
            <>
              {formatLkr(court.price_per_slot)}{" "}
              <span className="text-xs font-medium text-ink-3">/ slot</span>
            </>
          )}
        </p>
      </div>

      {!fullyBooked && durationMin === 0 && (
        <p className="mt-4 text-sm text-ink-3">Pick a duration above to see available slots.</p>
      )}
      {!fullyBooked && durationMin > 0 && !canFit && (
        <p className="mt-4 text-sm text-ink-3">Not available for {formatDuration(durationMin)}.</p>
      )}
      {!fullyBooked && canFit && (
        <div className="mt-4 border-t border-border pt-4">
          <SlotPicker
            availability={{ date, advance_days: advanceDays, courts: [court] }}
            isLoading={false}
            isError={false}
            onRetry={() => {}}
            selected={selected}
            onToggle={(c, s) => onToggle(s)}
            slotsCount={durationMin / court.slot_duration_min}
          />
        </div>
      )}
    </Card>
  );
}

function BookingSuccess({ booking }: { booking: { id: string; qr_token?: string | null; player_phone?: string | null; start_at: string } }) {
  const [qrData, setQrData] = useState<string | null>(null);

  useEffect(() => {
    void QRCode.toDataURL(booking.qr_token || booking.id, { margin: 1, width: 220 })
      .then(setQrData)
      .catch(() => setQrData(null));
  }, [booking]);

  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-light text-success">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-7 w-7">
          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <h3 className="font-display text-xl font-extrabold tracking-tight text-ink">You&apos;re booked!</h3>
        <p className="mt-1 text-sm text-ink-2">
          {booking.start_at ? dayjs(booking.start_at).format("ddd, D MMM · h:mm A") : ""} — show this QR at check-in.
        </p>
      </div>

      {qrData ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrData} alt="Check-in QR code" className="mx-auto h-44 w-44 rounded-2xl border border-border bg-white p-2" />
      ) : (
        <div className="mx-auto h-44 w-44 animate-pulse rounded-2xl border border-border bg-surface-2" />
      )}

      <div className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink-2">
        <p>
          Booking ID <span className="font-mono font-semibold text-ink">{booking.id.slice(0, 8)}</span>
        </p>
        <p className="mt-1">Pay at the venue on arrival. We also texted the QR to your phone.</p>
      </div>
    </div>
  );
}