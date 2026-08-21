"use client";

import { useEffect, useState } from "react";
import { Banknote, CheckCheck } from "lucide-react";
import { Badge, Button, Dialog, DialogContent, StatusPill } from "@spots/ui";
import { formatDateLong, formatLkr, formatTime12 } from "@spots/utils";
import { toApiFailure } from "@spots/api";
import type { Booking, CourtAvailability, Slot } from "@spots/types";
import { useBookingActions } from "@/features/admin-bookings/use-booking-actions";
import { SHEET_CLASS } from "./dialog-sheet";

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-3">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

export function BookingDetailDialog({
  open,
  onOpenChange,
  venueName,
  court,
  slot,
  booking
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venueName: string | undefined;
  court: CourtAvailability | null;
  slot: Slot | null;
  booking: Booking | null;
}) {
  const actions = useBookingActions();
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!open) setArmed(false);
  }, [open]);

  const failure = actions.checkIn.error || actions.markNoShow.error || actions.cancel.error || actions.markPaid.error;
  const failureInfo = failure ? toApiFailure(failure) : null;
  const busy = actions.checkIn.isPending || actions.markNoShow.isPending || actions.cancel.isPending || actions.markPaid.isPending;

  const start = slot?.start_at ?? booking?.start_at;
  const end = slot?.end_at ?? booking?.end_at;

  const isCash = booking?.payment_method === "cash";
  const cashPaid = isCash && booking?.paid_at;
  const showMarkPaid = isCash && !cashPaid && (booking?.status === "confirmed" || booking?.status === "checked_in");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setArmed(false);
        actions.checkIn.reset();
        actions.markNoShow.reset();
        actions.cancel.reset();
        onOpenChange(o);
      }}
    >
      <DialogContent
        className={SHEET_CLASS}
        title="Booking details"
        description={start ? formatDateLong(start) : undefined}
        onClose={() => onOpenChange(false)}
      >
        {booking ? (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={booking.status} />
                {isCash && (
                  <Badge variant={cashPaid ? "success" : "warning"}>
                    {cashPaid ? "Cash paid" : "Cash due"}
                  </Badge>
                )}
              </div>
              <p className="font-display text-xl font-extrabold text-ink">{formatLkr(booking.total_price)}</p>
            </div>

            <dl className="divide-y divide-border rounded-2xl bg-surface-2/60 px-4 py-1">
              <DetailRow label="Venue">{booking.venue_name ?? venueName ?? "—"}</DetailRow>
              <DetailRow label="Court">{booking.court_name ?? court?.name ?? "—"}</DetailRow>
              <DetailRow label="Player">{booking.player_name ?? "—"}</DetailRow>
              {booking.player_phone && <DetailRow label="Phone">{booking.player_phone}</DetailRow>}
              <DetailRow label="Time">
                {start && end ? `${formatTime12(start)}–${formatTime12(end)}` : "—"}
              </DetailRow>
              <DetailRow label="Booking">{booking.id}</DetailRow>
            </dl>

            {failureInfo && (
              <div className="rounded-2xl bg-error-light px-4 py-3 text-sm text-error">{failureInfo.message}</div>
            )}

            {booking.status === "confirmed" ? (
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                {showMarkPaid && (
                  <Button
                    variant="secondary"
                    onClick={() => actions.markPaid.mutate(booking.id)}
                    loading={actions.markPaid.isPending}
                    disabled={busy}
                  >
                    <Banknote className="h-4 w-4" /> Mark paid
                  </Button>
                )}
                <Button
                  onClick={() => actions.checkIn.mutate(booking.id)}
                  loading={actions.checkIn.isPending}
                  disabled={busy}
                >
                  Check in
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => actions.markNoShow.mutate(booking.id)}
                  loading={actions.markNoShow.isPending}
                  disabled={busy}
                >
                  Mark no-show
                </Button>
                <Button
                  variant={armed ? "destructive" : "secondary"}
                  onClick={() => {
                    if (armed) {
                      actions.cancel.mutate(booking.id);
                    } else {
                      setArmed(true);
                      setTimeout(() => setArmed(false), 5000);
                    }
                  }}
                  loading={actions.cancel.isPending}
                  disabled={busy}
                >
                  {armed ? "Tap again to cancel" : "Cancel booking"}
                </Button>
              </div>
            ) : booking.status === "checked_in" ? (
              <div className="space-y-2">
                <p className="flex items-center gap-2 rounded-2xl bg-success-light px-4 py-3 text-sm text-success">
                  <CheckCheck className="h-4 w-4" /> Checked in
                  {booking.checked_in_at ? ` at ${formatTime12(booking.checked_in_at)}` : ""}
                </p>
                {showMarkPaid && (
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => actions.markPaid.mutate(booking.id)}
                    loading={actions.markPaid.isPending}
                    disabled={busy}
                  >
                    <Banknote className="h-4 w-4" /> Mark cash received
                  </Button>
                )}
              </div>
            ) : (
              <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-ink-2">
                This booking is {booking.status.replace("_", " ")} and needs no action.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <dl className="divide-y divide-border rounded-2xl border border-border px-4 py-1">
              <DetailRow label="Venue">{venueName ?? "—"}</DetailRow>
              <DetailRow label="Court">{court?.name ?? "—"}</DetailRow>
              <DetailRow label="Time">
                {start && end ? `${formatTime12(start)}–${formatTime12(end)}` : "—"}
              </DetailRow>
            </dl>
            <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-ink-2">
              This slot is booked, but the booking record is not visible in today&apos;s list.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}