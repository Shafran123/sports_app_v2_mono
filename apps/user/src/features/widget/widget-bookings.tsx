"use client";

// "Your bookings" for a widget (ticket 05): lists the signed-in Player's own
// upcoming confirmed bookings for this venue, re-views the check-in QR, and
// allows self-cancel within the venue's Cancel Cutoff. Identity-first: if the
// session isn't phone+email verified, the unified identity step runs inline.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as QRCode from "qrcode";
import { ArrowLeft, CalendarClock, QrCode, X } from "lucide-react";
import { bookings, toApiFailure } from "@myslot/api";
import { Button, Card, ErrorState, Skeleton } from "@myslot/ui";
import { cn, dayjs, formatLkr, formatTime12 } from "@myslot/utils";
import type { Booking } from "@myslot/types";
import { useAuth } from "@/context/auth";
import { WidgetIdentity } from "./widget-identity";

export function WidgetBookings({
  widgetKey,
  venue,
  onBack
}: {
  widgetKey?: string;
  venue: { id: string; name: string; cancel_cutoff_hours?: number };
  onBack: () => void;
}) {
  const { user } = useAuth();
  const ready = !!user?.phone_verified_at && !!user?.email_verified_at;

  if (!ready) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-10">
        <button
          type="button"
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-ink-3 transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to booking
        </button>
        <WidgetIdentity widgetKey={widgetKey} onDone={onBack} />
      </div>
    );
  }

  return <BookingsView venueId={venue.id} cancelCutoffHours={venue.cancel_cutoff_hours ?? 2} onBack={onBack} />;
}

function BookingsView({
  venueId,
  cancelCutoffHours,
  onBack
}: {
  venueId: string;
  cancelCutoffHours: number;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const listQuery = useQuery({
    queryKey: ["widget-bookings", venueId],
    queryFn: async () => {
      // Server-scoped: the widget passes its venue so the backend returns
      // exactly this embed's bookings — no client-side filter to go stale.
      return bookings.list("upcoming", { venue_id: venueId });
    }
  });

  const cancel = useMutation({
    mutationFn: (id: string) => bookings.cancel(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["widget-bookings", venueId] });
    }
  });

  const handleCancel = (booking: Booking) => {
    if (!window.confirm("Cancel this booking? Pay at the venue on arrival — no charge.")) return;
    cancel.mutate(booking.id);
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 pb-10">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs font-semibold text-ink-3 transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to booking
      </button>

      <div>
        <h3 className="pt-3 font-display text-lg font-extrabold tracking-tight text-ink">Your bookings</h3>
        <p className="mt-0.5 text-sm text-ink-2">Upcoming bookings at this venue.</p>
      </div>

      {cancel.isError && (
        <p className="rounded-xl bg-error-light px-3 py-2 text-sm text-error">
          {toApiFailure(cancel.error).message}
        </p>
      )}

      {listQuery.isLoading ? (
        <Skeleton className="h-32 w-full rounded-3xl" />
      ) : listQuery.isError ? (
        <ErrorState title="Could not load bookings" onRetry={() => listQuery.refetch()} />
      ) : listQuery.data && listQuery.data.length === 0 ? (
        <div className="rounded-3xl border border-border bg-surface p-8 text-center">
          <CalendarClock className="mx-auto h-8 w-8 text-ink-3" />
          <p className="mt-3 text-sm text-ink-2">No upcoming bookings at this venue yet.</p>
        </div>
      ) : (
        (listQuery.data ?? []).map((booking) => (
          <BookingCard
            key={booking.id}
            booking={booking}
            cancelCutoffHours={cancelCutoffHours}
            onCancel={handleCancel}
            cancelling={cancel.isPending && cancel.variables === booking.id}
          />
        ))
      )}
    </div>
  );
}

function BookingCard({
  booking,
  cancelCutoffHours,
  onCancel,
  cancelling
}: {
  booking: Booking;
  cancelCutoffHours: number;
  onCancel: (b: Booking) => void;
  cancelling: boolean;
}) {
  const [showQr, setShowQr] = useState(false);
  const hoursToStart = dayjs(booking.start_at).diff(dayjs(), "hour", true);
  const pastCutoff = hoursToStart <= cancelCutoffHours;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold tracking-tight text-ink">{booking.court_name || booking.venue_name || "Booking"}</p>
          <p className="mt-0.5 text-sm text-ink-2">
            {formatTime12(booking.start_at)} – {formatTime12(booking.end_at)} ·{" "}
            {dayjs(booking.start_at).format("ddd, D MMM")}
          </p>
        </div>
        <p className="font-display text-base font-extrabold text-ink">{formatLkr(booking.total_price)}</p>
      </div>

      {showQr ? <QrRow booking={booking} onClose={() => setShowQr(false)} /> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => setShowQr((v) => !v)}>
          <QrCode className="h-4 w-4" /> {showQr ? "Hide QR" : "Show QR"}
        </Button>
        <div className="flex-1">
          <Button
            variant="ghost"
            disabled={pastCutoff || cancelling}
            onClick={() => onCancel(booking)}
            className={cn(
              "w-full text-error hover:bg-error-light hover:text-error",
              pastCutoff && "cursor-not-allowed opacity-50"
            )}
          >
            {cancelling ? "Cancelling…" : "Cancel"}
          </Button>
          {pastCutoff && (
            <p className="mt-1 text-center text-xs text-ink-3">
              Past the cancel cutoff — contact the venue.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

function QrRow({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const qrQuery = useQuery({
    queryKey: ["widget-booking-qr", booking.id],
    queryFn: async () => {
      // The list payload is scrubbed of the QR token; the token is disclosed
      // only to the booking's own player on the detail endpoint.
      const detail = await bookings.get(booking.id);
      return QRCode.toDataURL(detail.qr_token || detail.id, { margin: 1, width: 220 });
    }
  });

  return (
    <div className="mt-4 rounded-2xl border border-border bg-surface-2 p-4 text-center">
      {qrQuery.isLoading ? (
        <div className="mx-auto h-40 w-40 animate-pulse rounded-xl bg-surface" />
      ) : qrQuery.isError || !qrQuery.data ? (
        <p className="py-8 text-sm text-error">Could not load your QR. Try again.</p>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qrQuery.data}
          alt="Check-in QR code"
          className="mx-auto h-40 w-40 rounded-xl border border-border bg-white p-2"
        />
      )}
      <p className="mt-2 text-xs text-ink-3">
        Booking ID <span className="font-mono font-semibold text-ink-2">{booking.id.slice(0, 8)}</span>
      </p>
      <button
        type="button"
        aria-label="Close QR"
        onClick={onClose}
        className="mx-auto mt-1 block rounded-full p-1 text-ink-3 transition-colors hover:bg-surface hover:text-ink"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}