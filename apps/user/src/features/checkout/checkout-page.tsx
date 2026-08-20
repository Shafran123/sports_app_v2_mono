"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { bookings, toApiFailure } from "@spots/api";
import { Badge, Button, Card, CardContent, CountdownPill, ErrorState, Skeleton } from "@spots/ui";
import { formatDateLong, formatLkr, formatTime12 } from "@spots/utils";
import { useAuth } from "@/context/auth";
import { submitPayHereForm } from "./payhere-submit";

export function CheckoutPage({ venueId }: { venueId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const courtId = searchParams?.get("court_id") ?? "";
  const startAt = searchParams?.get("start_at") ?? "";
  const endAt = searchParams?.get("end_at") ?? "";
  const venueName = searchParams?.get("venue") ?? "";
  const venueSlug = searchParams?.get("venue_slug") ?? "";
  const courtName = searchParams?.get("court") ?? "";
  const rawPricePerSlot = searchParams?.get("price_per_slot");
  const rawSlots = searchParams?.get("slots");

  const incomplete = !courtId || !startAt || !endAt;

  const checkout = useMutation({
    mutationFn: () =>
      bookings.checkout(undefined, { court_id: courtId, start_at: startAt, end_at: endAt })
  });

  const started = React.useRef(false);
  React.useEffect(() => {
    if (incomplete || started.current) return;
    started.current = true;
    void checkout.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomplete]);

  const result = checkout.data;
  const [secondsLeft, setSecondsLeft] = React.useState(0);
  const [expired, setExpired] = React.useState(false);
  const [paying, setPaying] = React.useState(false);

  React.useEffect(() => {
    if (!result || expired) return;
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(result.expires_at).getTime() - Date.now()) / 1000)
      );
      setSecondsLeft(remaining);
      if (remaining <= 0) setExpired(true);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [result, expired]);

  const failure = checkout.error ? toApiFailure(checkout.error) : null;
  const slotTaken = failure?.code === "BOOKING_SLOT_UNAVAILABLE";
  const dateKey = startAt.slice(0, 10);
  const venueHref = venueSlug ? `/venues/${venueSlug}?date=${dateKey}` : "/venues";

  const handlePay = () => {
    if (!result || paying) return;
    setPaying(true);
    submitPayHereForm(result.payment_params, {
      name: user?.name,
      email: user?.email,
      phone: user?.phone,
      city: user?.city
    });
  };

  const payLabel = paying ? "Redirecting to PayHere…" : "Pay now";

  if (incomplete) {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-8">
        <ErrorState
          title="Checkout details are missing"
          message="We could not find the court and time you selected. Please pick a slot again."
        />
        <div className="mt-6 flex justify-center">
          <Button variant="secondary" onClick={() => router.push("/explore")}>
            Find a venue
          </Button>
        </div>
      </main>
    );
  }

  if (checkout.isPending) {
    return <CheckoutSkeleton />;
  }

  if (checkout.error) {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-8">
        {slotTaken ? (
          <>
            <ErrorState
              title="This slot was taken"
              message={failure?.message ?? "Someone else booked this slot just before you."}
            />
            <div className="mt-6 flex justify-center">
              <Button variant="secondary" size="lg" onClick={() => router.push(venueHref)}>
                See alternatives
              </Button>
            </div>
          </>
        ) : (
          <ErrorState
            title="Could not start checkout"
            message={failure?.message ?? "We could not start your checkout right now."}
            onRetry={() => checkout.mutate()}
          />
        )}
      </main>
    );
  }

  if (!result) {
    return <CheckoutSkeleton />;
  }

  const pricePerSlot = rawPricePerSlot ? Number(rawPricePerSlot) : null;
  const slotsCount = rawSlots
    ? Number(rawSlots)
    : pricePerSlot && pricePerSlot > 0
      ? Math.max(1, Math.round(result.amount / pricePerSlot))
      : null;
  const rateLine =
    slotsCount && pricePerSlot
      ? `${slotsCount} × ${formatLkr(pricePerSlot)}`
      : pricePerSlot
        ? formatLkr(pricePerSlot)
        : null;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-40 pt-8 md:pb-14">
      <Link
        href={venueHref}
        className="press inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        {venueName || "Back to venue"}
      </Link>

      <div className="mt-5">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">
          Checkout
        </h1>
        <p className="mt-1 text-sm text-ink-2">Confirm your slot and pay to lock it in.</p>
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardContent className="px-6 pt-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-semibold text-ink">{courtName || "Court"}</h2>
              <p className="mt-0.5 text-sm text-ink-2">{venueName || "Venue"}</p>
            </div>
            <CountdownPill seconds={secondsLeft} className="shrink-0" />
          </div>

          <dl className="mt-5 divide-y divide-border">
            <DetailRow label="Date" value={formatDateLong(startAt)} />
            <DetailRow label="Time" value={`${formatTime12(startAt)} – ${formatTime12(endAt)}`} />
            {rateLine && <DetailRow label="Rate" value={rateLine} />}
          </dl>
        </CardContent>

        <div className="border-t border-border px-6 py-5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-ink-2">Total</span>
            <span className="font-display text-2xl font-extrabold tabular-nums text-ink">
              {formatLkr(result.amount)}
            </span>
          </div>
          <Button
            size="lg"
            loading={paying}
            disabled={expired}
            onClick={handlePay}
            className="mt-4 hidden w-full md:inline-flex"
          >
            {payLabel}
          </Button>
        </div>
      </Card>

      {expired && (
        <div className="mt-4 rounded-3xl border border-error/30 bg-error-light/40 p-5">
          <p className="font-semibold text-error">The hold has expired — slots were released</p>
          <p className="mt-1 text-sm text-ink-2">Pick another slot at this venue and try again.</p>
          <Link
            href={venueHref}
            className="mt-3 inline-flex text-sm font-semibold text-primary hover:text-primary-hover"
          >
            Back to venue →
          </Link>
        </div>
      )}

      <p className="mt-5 flex flex-wrap items-center gap-2 text-sm text-ink-2">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        You&apos;ll be redirected to PayHere to complete payment (sandbox).
        <Badge variant="warning">Sandbox</Badge>
      </p>

      <div className="fixed inset-x-0 bottom-16 z-40 border-t border-border bg-paper/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-ink-2">Total</p>
            <p className="font-display text-lg font-extrabold tabular-nums text-ink">
              {formatLkr(result.amount)}
            </p>
          </div>
          <Button size="lg" loading={paying} disabled={expired} onClick={handlePay} className="min-w-44 flex-1">
            {payLabel}
          </Button>
        </div>
      </div>
    </main>
  );
}

function CheckoutSkeleton() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-8">
      <Skeleton className="h-5 w-48" />
      <div className="mt-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="mt-2 h-4 w-1/2" />
      </div>
      <div className="mt-6 rounded-3xl border border-border bg-surface p-6 shadow-soft">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-2/3" />
        <Skeleton className="mt-4 h-12 w-full" />
      </div>
    </main>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}