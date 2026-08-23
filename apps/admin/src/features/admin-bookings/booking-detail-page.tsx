"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { bookings, toApiFailure } from "@myslot/api";
import { Button, Card, Dialog, DialogContent, ErrorState, Skeleton, StatusPill } from "@myslot/ui";
import { formatDateLong, formatLkr, formatTime12 } from "@myslot/utils";
import type { Booking } from "@myslot/types";
import { SHEET_CLASS } from "@myslot/ui";
import { useBookingActions } from "./use-booking-actions";
import { BookingStatusSteps } from "./status-steps";

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-3">{label}</dt>
      <dd className="text-right text-sm font-semibold text-ink">{children}</dd>
    </div>
  );
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-border bg-surface p-5 shadow-soft">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">{title}</h2>
      <dl className="mt-2 divide-y divide-border">{children}</dl>
    </div>
  );
}

function BookingDetailSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-40 w-full rounded-3xl" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-3xl" />
        ))}
      </div>
    </div>
  );
}

export function BookingDetailPage({ bookingId }: { bookingId: string }) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const bookingQuery = useQuery({
    queryKey: ["admin-booking", bookingId],
    queryFn: () => bookings.get(bookingId)
  });
  const actions = useBookingActions([["admin-booking", bookingId]]);

  const booking = bookingQuery.data;

  if (bookingQuery.isLoading) return <BookingDetailSkeleton />;

  if (bookingQuery.isError || !booking) {
    const failure = bookingQuery.error ? toApiFailure(bookingQuery.error) : null;
    const notFound = failure?.status === 404;
    return (
      <div className="mx-auto max-w-4xl">
        <ErrorState
          title={notFound ? "Booking not found" : "Could not load this booking"}
          message={
            notFound
              ? "This booking does not exist or you do not have access to it."
              : failure?.message ?? "Something went wrong while fetching this booking."
          }
          onRetry={notFound ? undefined : () => void bookingQuery.refetch()}
        />
      </div>
    );
  }

  const failureInfo =
    actions.checkIn.error || actions.markNoShow.error || actions.cancel.error
      ? toApiFailure(actions.checkIn.error ?? actions.markNoShow.error ?? actions.cancel.error)
      : null;
  const busy = actions.checkIn.isPending || actions.markNoShow.isPending || actions.cancel.isPending;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">Booking details</h1>
          <p className="mt-1 font-mono text-sm text-ink-3">#{booking.id}</p>
        </div>
        <Link href="/bookings" className="text-sm font-semibold text-primary hover:underline">
          ← Back to bookings
        </Link>
      </div>

      <div className="rounded-3xl border border-border bg-surface p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <StatusPill status={booking.status} />
            <p className="mt-2 text-sm text-ink-2">
              {booking.venue_name ?? "Venue"} · {booking.court_name ?? "Court"}
            </p>
          </div>
          <p className="font-display text-3xl font-extrabold text-ink">{formatLkr(booking.total_price)}</p>
        </div>
        <BookingStatusSteps status={booking.status} className="mt-8" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DetailCard title="Venue & court">
          <InfoRow label="Venue">{booking.venue_name ?? "—"}</InfoRow>
          {booking.venue_address && <InfoRow label="Address">{booking.venue_address}</InfoRow>}
          {booking.venue_city && <InfoRow label="City">{booking.venue_city}</InfoRow>}
          <InfoRow label="Court">{booking.court_name ?? "—"}</InfoRow>
          {booking.sport && <InfoRow label="Sport">{booking.sport}</InfoRow>}
        </DetailCard>

        <DetailCard title="Player">
          <InfoRow label="Name">{booking.player_name ?? "—"}</InfoRow>
          <InfoRow label="Phone">{booking.player_phone ?? "—"}</InfoRow>
          <InfoRow label="Booking ref">
            <span className="font-mono text-xs text-ink-2">{booking.id}</span>
          </InfoRow>
        </DetailCard>

        <DetailCard title="Time">
          <InfoRow label="Date">{formatDateLong(booking.start_at)}</InfoRow>
          <InfoRow label="Slot">
            {formatTime12(booking.start_at)}–{formatTime12(booking.end_at)}
          </InfoRow>
        </DetailCard>

        <DetailCard title="Payment">
          <InfoRow label="Total">{formatLkr(booking.total_price)}</InfoRow>
          <InfoRow label="Per slot">{formatLkr(booking.price_per_slot)}</InfoRow>
          <InfoRow label="Method">
            {booking.payment_method ? booking.payment_method.replace("_", " ") : "—"}
          </InfoRow>
        </DetailCard>
      </div>

      <div className="rounded-3xl border border-border bg-surface p-5 shadow-soft">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Actions</h2>
        {failureInfo && (
          <div className="mt-3 rounded-2xl bg-error-light px-4 py-3 text-sm text-error">{failureInfo.message}</div>
        )}
        {booking.status === "confirmed" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => actions.checkIn.mutate(booking.id)} loading={actions.checkIn.isPending} disabled={busy}>
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
            <Button variant="destructive" onClick={() => setCancelOpen(true)} disabled={busy}>
              Cancel booking
            </Button>
          </div>
        ) : booking.status === "checked_in" ? (
          <p className="mt-3 rounded-2xl bg-success-light px-4 py-3 text-sm text-success">
            Checked in — no further actions available.
          </p>
        ) : (
          <p className="mt-3 rounded-2xl bg-surface-2 px-4 py-3 text-sm text-ink-2">
            This booking is {booking.status.replace("_", " ")} and needs no action.
          </p>
        )}
      </div>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent
          className={SHEET_CLASS}
          title="Cancel this booking?"
          description="The slot will be freed up and the booking marked as cancelled. This cannot be undone."
          onClose={() => setCancelOpen(false)}
        >
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCancelOpen(false)} disabled={actions.cancel.isPending}>
              Keep booking
            </Button>
            <Button
              variant="destructive"
              loading={actions.cancel.isPending}
              onClick={() => actions.cancel.mutate(booking.id, { onSuccess: () => setCancelOpen(false) })}
            >
              Cancel booking
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}