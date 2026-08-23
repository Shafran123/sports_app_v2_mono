"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import * as QRCode from "qrcode";
import { CircleCheckBig, Copy, MapPin, RefreshCw } from "lucide-react";
import { bookings, toApiFailure } from "@myslot/api";
import { Button, Card, CardContent, CardFooter, ErrorState, Skeleton, SkeletonRow } from "@myslot/ui";
import { formatDateLong, formatLkr, formatTime12 } from "@myslot/utils";

const SUCCESS_STATUSES = new Set(["confirmed", "checked_in", "completed"]);
const FAILED_STATUSES = new Set(["cancelled", "failed"]);
const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 60_000;

export function BookingConfirmationPage({ bookingId }: { bookingId: string }) {
  const router = useRouter();

  const [timedOut, setTimedOut] = React.useState(false);
  const [qrSrc, setQrSrc] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const query = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: () => bookings.get(bookingId),
    enabled: !!bookingId && !timedOut,
    retry: 0,
    refetchInterval: (q) => {
      if (timedOut) return false;
      const s = q.state.data?.status;
      if (s && (SUCCESS_STATUSES.has(s) || FAILED_STATUSES.has(s))) return false;
      return POLL_INTERVAL_MS;
    }
  });

  const booking = query.data;
  const status = booking?.status;
  const isSuccess = !!status && SUCCESS_STATUSES.has(status);
  const isFailed = !!status && FAILED_STATUSES.has(status);
  const shouldPoll = !!bookingId && !isSuccess && !isFailed && !timedOut;

  React.useEffect(() => {
    if (!shouldPoll) return;
    const timer = setTimeout(() => setTimedOut(true), POLL_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [shouldPoll]);

  React.useEffect(() => {
    if (!booking || !SUCCESS_STATUSES.has(booking.status)) return;
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
  }, [booking]);

  const retry = () => {
    setTimedOut(false);
    void query.refetch();
  };

  const copyId = async () => {
    if (!booking) return;
    await navigator.clipboard.writeText(booking.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (shouldPoll) {
    return (
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-8">
        <div>
          <h1 className="font-display text-xl font-extrabold tracking-tight text-ink">
            Confirming your booking…
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            We&apos;re checking with the payment provider. This usually takes a few seconds.
          </p>
        </div>
        <div className="mt-6 space-y-4">
          <SkeletonRow />
          <SkeletonRow />
          <Skeleton className="h-64 w-full rounded-3xl" />
        </div>
      </main>
    );
  }

  if (timedOut) {
    const failure = query.error ? toApiFailure(query.error) : null;
    return (
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-8">
        <ErrorState
          title="We couldn&apos;t confirm your booking"
          message={
            failure?.status === 404
              ? "We could not find this booking. If you just paid, it may take a moment to appear here."
              : "Your payment may still be processing. Check your bookings in a few minutes."
          }
        />
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" onClick={() => router.push("/bookings")}>
            Done
          </Button>
          <Button variant="secondary" className="flex-1" onClick={retry}>
            <RefreshCw className="h-4 w-4" /> Try again
          </Button>
        </div>
      </main>
    );
  }

  if (isFailed) {
    const cancelled = status === "cancelled";
    return (
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-8">
        <ErrorState
          title={cancelled ? "Booking cancelled" : "Payment didn&apos;t complete"}
          message={
            cancelled
              ? "This booking was cancelled. Any amount held on your payment has been released."
              : "Your payment did not complete, so this booking was not created."
          }
        />
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" onClick={() => router.push("/bookings")}>
            Go to my bookings
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => router.push("/explore")}>
            Explore venues
          </Button>
        </div>
      </main>
    );
  }

  if (!booking) {
    return (
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-8">
        <ErrorState title="Booking not found" message="We could not load this booking." onRetry={retry} />
      </main>
    );
  }

  const viewVenueHref = `/explore?search=${encodeURIComponent(booking.venue_name ?? "")}`;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-32 pt-8 md:pb-14">
      <Card className="animate-pop-in overflow-hidden">
        <CardContent className="px-6 pt-8">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-light text-primary">
              <CircleCheckBig className="h-8 w-8" />
            </div>
            <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-ink">
              Booking confirmed
            </h1>
            <p className="mt-1 text-sm text-ink-2">
              Your booking is locked in. Show the QR code at the venue to check in.
            </p>
          </div>
        </CardContent>

        <div className="border-t border-border px-6 py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-widest text-ink-3">Booking ID</p>
              <p className="mt-0.5 truncate font-mono text-sm text-ink">{booking.id}</p>
            </div>
            <Button variant="outline" size="sm" className="shrink-0" onClick={copyId}>
              <Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy"}
            </Button>
          </div>

          <div className="mt-5 space-y-2.5">
            <DetailRow label="Venue" value={booking.venue_name ?? "—"} />
            <DetailRow label="Court" value={booking.court_name ?? "—"} />
            <DetailRow label="Date" value={formatDateLong(booking.start_at)} />
            <DetailRow
              label="Time"
              value={`${formatTime12(booking.start_at)} – ${formatTime12(booking.end_at)}`}
            />
            <DetailRow label="Paid" value={formatLkr(booking.total_price)} strong />
          </div>
        </div>

        <div className="border-t border-border px-6 py-6">
          <p className="text-xs uppercase tracking-widest text-ink-3">Check-in QR</p>
          {qrSrc ? (
            <div className="mt-3 flex flex-col items-center">
              <div className="rounded-3xl bg-white p-4 shadow-soft">
                <img src={qrSrc} alt="Booking check-in QR code" className="h-56 w-56" />
              </div>
              <p className="mt-3 text-sm text-ink-2">Show this QR code at the venue</p>
            </div>
          ) : (
            <Skeleton className="mx-auto mt-3 h-56 w-56 rounded-3xl" />
          )}
        </div>

        <CardFooter className="flex flex-col gap-2 px-5 pt-0 sm:flex-row">
          <Button className="flex-1" onClick={() => router.push("/bookings")}>
            Done
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => router.push(viewVenueHref)}>
            <MapPin className="h-4 w-4" /> View venue
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}

function DetailRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd className={strong ? "font-display font-extrabold tabular-nums text-ink" : "font-medium text-ink"}>
        {value}
      </dd>
    </div>
  );
}