"use client";

import * as React from "react";
import * as QRCode from "qrcode";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { buttonVariants, Dialog, DialogContent, SHEET_CLASS, Skeleton, StatusPill } from "@myslot/ui";
import { formatDateLong, formatLkr, formatTime12 } from "@myslot/utils";
import type { Booking } from "@myslot/types";

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-3">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

export function BookingDetailDialog({
  booking,
  open,
  onOpenChange
}: {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [qrSrc, setQrSrc] = React.useState<string | null>(null);

  React.useEffect(() => {
    setQrSrc(null);
    if (!booking || !open) return;
    const text = booking.qr_token || booking.id;
    let cancelled = false;
    void QRCode.toDataURL(text)
      .then((url) => {
        if (!cancelled) setQrSrc(url);
      })
      .catch(() => {
        if (!cancelled) setQrSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [booking, open]);

  if (!booking) return null;

  const venueHref = `/explore?search=${encodeURIComponent(booking.venue_name ?? "")}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={SHEET_CLASS}
        title="Booking details"
        description={formatDateLong(booking.start_at)}
        onClose={() => onOpenChange(false)}
      >
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <StatusPill status={booking.status} />
            <p className="font-display text-xl font-extrabold text-ink">{formatLkr(booking.total_price)}</p>
          </div>

          <dl className="divide-y divide-border rounded-2xl bg-surface-2/60 px-4 py-1">
            <DetailRow label="Venue">{booking.venue_name ?? "—"}</DetailRow>
            <DetailRow label="Court">{booking.court_name ?? "—"}</DetailRow>
            <DetailRow label="Time">
              {formatTime12(booking.start_at)}–{formatTime12(booking.end_at)}
            </DetailRow>
            <DetailRow label="Payment">
              {booking.payment_method === "cash"
                ? booking.payment_status === "paid" || booking.paid_at
                  ? "Cash — paid"
                  : "Cash — due at venue"
                : "Paid online"}
            </DetailRow>
            <DetailRow label="Booking ID">{booking.id}</DetailRow>
          </dl>

          {booking.status === "pending" ? (
            <div className="flex flex-col items-center rounded-3xl border border-dashed border-warning bg-warning-light/40 p-4 text-center">
              <p className="text-sm font-semibold text-warning">Awaiting venue confirmation</p>
              <p className="mt-1 text-xs text-ink-2">
                The venue will confirm your booking shortly. You can cancel this request any time.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-3xl border border-border bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-3">Check-in QR</p>
              {qrSrc ? (
                <img src={qrSrc} alt="Booking check-in QR code" className="mt-3 h-48 w-48" />
              ) : (
                <Skeleton className="mt-3 h-48 w-48 rounded-3xl" />
              )}
              <p className="mt-3 text-sm text-ink-2">Show this QR code at the venue</p>
            </div>
          )}

          <Link href={venueHref} className={buttonVariants({ variant: "secondary", size: "block" })}>
            <MapPin className="h-4 w-4" /> View venue
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}