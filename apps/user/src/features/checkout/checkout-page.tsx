"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Banknote, ShieldCheck, Wallet } from "lucide-react";
import { bookings, featureFlags, toApiFailure, venues } from "@spots/api";
import { Badge, Button, Card, CardContent, CountdownPill, ErrorState, Skeleton } from "@spots/ui";
import { formatDateLong, formatLkr, formatTime12, uuidV4 } from "@spots/utils";
import { useAuth } from "@/context/auth";
import { submitPayHere } from "@spots/api";
import { VerifyPhoneModal } from "@/features/verify-phone/verify-phone-modal";

type PaymentMethod = "online" | "cash";

export function CheckoutPage({ venueId }: { venueId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [verifyOpen, setVerifyOpen] = React.useState(false);

  const { data: flags } = useQuery({
    queryKey: ["feature-flags"],
    queryFn: () => featureFlags.get()
  });
  // Platform gates mirror the server (which stays authoritative): when the
  // payhere_enabled flag is OFF only pay-at-venue is offered, and the phone
  // gate only applies when the flag is ON. Flag defaults match the server
  // registry (OFF) so an in-flight fetch never shows a state the server
  // would reject.
  const payhereEnabled = flags?.payhere_enabled ?? false;
  const requiresVerification = flags?.phone_verification_required ?? false;
  const verified = !!user?.phone_verified_at;

  const courtId = searchParams?.get("court_id") ?? "";
  const startAt = searchParams?.get("start_at") ?? "";
  const endAt = searchParams?.get("end_at") ?? "";
  const venueNameParam = searchParams?.get("venue") ?? "";
  const courtNameParam = searchParams?.get("court") ?? "";
  const rawPricePerSlot = searchParams?.get("price_per_slot");
  const rawSlots = searchParams?.get("slots");

  const incomplete = !courtId || !startAt || !endAt;

  const venueQuery = useQuery({
    queryKey: ["venue", venueId],
    queryFn: () => venues.detail(venueId),
    enabled: !incomplete
  });
  const acceptsCash = !!venueQuery.data?.accepts_cash;

  // Display names come from the query params built at the venue page; fall
  // back to the venue/court fetch so the confirmation never shows "—".
  const venueName = venueNameParam || venueQuery.data?.name || "";
  const courtName =
    courtNameParam ||
    venueQuery.data?.courts.find((c) => c.id === courtId)?.name ||
    "";

  const [method, setMethod] = React.useState<PaymentMethod>("online");
  const [chosen, setChosen] = React.useState(false);
  const [checkoutKey, setCheckoutKey] = React.useState(() => uuidV4());

  // With online payments paused (payhere_enabled OFF) cash is the only option.
  const onlineAvailable = payhereEnabled;
  const effectiveMethod: PaymentMethod = onlineAvailable ? method : "cash";

  const checkout = useMutation({
    mutationFn: () =>
      bookings.checkout({
        court_id: courtId,
        start_at: startAt,
        end_at: endAt,
        idempotency_key: checkoutKey,
        payment_method: effectiveMethod,
        player_phone: user?.phone ?? undefined
      })
  });

  React.useEffect(() => {
    if (incomplete || venueQuery.isLoading || !flags) return;
    if (requiresVerification && !verified) {
      setVerifyOpen(true);
      return;
    }
    // For venues that accept cash with online still available, wait for the
    // player to pick a method.
    if (!chosen && acceptsCash && onlineAvailable) return;
    // When online payments are paused and the venue has no cash option there
    // is nothing to offer — the paused card renders and no request fires.
    if (!onlineAvailable && !acceptsCash) return;
    // A cash booking is created server-side when it is confirmed, so it must
    // never auto-fire: it needs an explicit confirmation of the summary.
    if (effectiveMethod === "cash") return;
    if (checkout.isPending) return;
    if (checkout.data || checkout.error) return;
    void checkout.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomplete, venueQuery.isLoading, flags, chosen, acceptsCash, method, checkoutKey, verified, onlineAvailable, requiresVerification, effectiveMethod]);

  const result = checkout.data;
  const isCash = !!result?.booking;
  const [secondsLeft, setSecondsLeft] = React.useState(0);
  const [expired, setExpired] = React.useState(false);
  const [paying, setPaying] = React.useState(false);

  React.useEffect(() => {
    if (!result || isCash || expired) return;
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(result.expires_at!).getTime() - Date.now()) / 1000)
      );
      setSecondsLeft(remaining);
      if (remaining <= 0) setExpired(true);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [result, isCash, expired]);

  const failure = checkout.error ? toApiFailure(checkout.error) : null;
  const slotTaken = failure?.code === "BOOKING_SLOT_UNAVAILABLE";
  const dateKey = startAt.slice(0, 10);
  // The venue route segment is the venue UUID (venues/[id]) — never the sport
  // slug that the CTA carries for display purposes.
  const venueHref = `/venues/${venueId}?date=${dateKey}`;

  const renderVerifyModal = () => (
    <VerifyPhoneModal
      open={verifyOpen}
      onClose={() => setVerifyOpen(false)}
      onVerified={() => {
        setVerifyOpen(false);
        checkout.reset();
      }}
    />
  );

  const chooseMethod = (next: PaymentMethod) => {
    if (checkout.isPending) return;
    if (!onlineAvailable && next === "online") return;
    if (next === method && chosen) return;
    setChosen(true);
    setMethod(next);
    setCheckoutKey(uuidV4());
    checkout.reset();
  };

  const handlePay = () => {
    if (!result || paying) return;
    setPaying(true);
    if (!result.payment_params) return;
    submitPayHere(result.payment_params, {
      first_name: user?.name,
      last_name: user?.name,
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
    const needsVerify = failure?.code === "VERIFIED_PHONE_REQUIRED";
    return (
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-8">
        {needsVerify ? (
          <>
            <ErrorState
              title="Verify your phone first"
              message="You need a verified phone to book. We'll text you a code — it takes a second."
            />
            <div className="mt-6 flex justify-center">
              <Button size="lg" onClick={() => setVerifyOpen(true)}>
                Verify phone
              </Button>
            </div>
          </>
        ) : slotTaken ? (
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
        {renderVerifyModal()}
      </main>
    );
  }

  if (isCash && result?.booking) {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-32 pt-8 md:pb-14">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">
          Booking confirmed
        </h1>
        <Card className="mt-6 overflow-hidden">
          <CardContent className="px-6 py-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-primary">
              <Banknote className="h-7 w-7" />
            </div>
            <h2 className="mt-4 font-display text-xl font-extrabold text-ink">Pay on arrival</h2>
            <p className="mt-1 text-sm text-ink-2">
              Your slot is locked in. Pay{" "}
              <span className="font-semibold text-ink">{formatLkr(result.amount)}</span> at the
              venue.
            </p>
            <dl className="mx-auto mt-5 max-w-sm space-y-2 text-left text-sm">
              <DetailRow label="Venue" value={venueName || "—"} />
              <DetailRow label="Court" value={courtName || "Court"} />
              <DetailRow label="Date" value={formatDateLong(startAt)} />
              <DetailRow
                label="Time"
                value={`${formatTime12(startAt)} – ${formatTime12(endAt)}`}
              />
            </dl>
            <Button size="lg" className="mt-6 w-full" onClick={() => router.push(`/bookings/${result.booking!.id}`)}>
              View booking & QR code
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const pricePerSlot = rawPricePerSlot ? Number(rawPricePerSlot) : null;
  const slotsCount = rawSlots
    ? Number(rawSlots)
    : pricePerSlot && pricePerSlot > 0 && result?.amount
      ? Math.max(1, Math.round(result.amount / pricePerSlot))
      : null;
  const rateLine =
    slotsCount && pricePerSlot
      ? `${slotsCount} × ${formatLkr(pricePerSlot)}`
      : pricePerSlot
        ? formatLkr(pricePerSlot)
        : null;
  const rateTotal =
    slotsCount && pricePerSlot ? slotsCount * pricePerSlot : (result?.amount ?? 0);

  if (!result) {
    const pausedAndNoCash = !onlineAvailable && !acceptsCash;
    return (
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-8">
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

        {requiresVerification && !verified && (
          <div className="mt-5 rounded-3xl border border-warning/40 bg-warning-light px-4 py-3 text-sm font-medium">
            You need a verified phone to book.{" "}
            <button
              type="button"
              className="font-semibold text-primary underline-offset-2 hover:underline"
              onClick={() => setVerifyOpen(true)}
            >
              Verify now
            </button>
          </div>
        )}

        {pausedAndNoCash ? (
          <Card className="mt-6 p-6">
            <h2 className="font-semibold text-ink">Online payment is paused</h2>
            <p className="mt-1 text-sm text-ink-2">
              Pay-at-venue is temporarily unavailable at this venue. Choose a venue that offers
              pay-at-venue, or check back soon.
            </p>
            <Button variant="secondary" className="mt-4" onClick={() => router.push(venueHref)}>
              Pick a different venue
            </Button>
          </Card>
        ) : (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Payment method">
              <MethodCard
                icon={<Wallet className="h-5 w-5" />}
                title="Pay online"
                subtitle={onlineAvailable ? "PayHere · instant confirmation" : "Temporarily unavailable"}
                badge={onlineAvailable ? undefined : "Paused"}
                active={onlineAvailable && method === "online"}
                disabled={!onlineAvailable}
                onClick={() => chooseMethod("online")}
                dataTestId="method-online"
              />
              <MethodCard
                icon={<Banknote className="h-5 w-5" />}
                title="Pay at venue"
                subtitle="Cash on arrival"
                active={effectiveMethod === "cash"}
                onClick={() => chooseMethod("cash")}
                dataTestId="method-cash"
              />
            </div>

            {effectiveMethod === "cash" && (
              <>
                <Card className="mt-6 overflow-hidden">
                  <CardContent className="px-6 pt-8">
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-semibold text-ink">{courtName || "Court"}</h2>
                      <p className="mt-0.5 text-sm text-ink-2">{venueName || "Venue"}</p>
                    </div>

                    <dl className="mt-5 divide-y divide-border">
                      <DetailRow label="Venue" value={venueName || "—"} />
                      <DetailRow label="Date" value={formatDateLong(startAt)} />
                      <DetailRow label="Time" value={`${formatTime12(startAt)} – ${formatTime12(endAt)}`} />
                      {rateLine && <DetailRow label="Rate" value={rateLine} />}
                    </dl>
                  </CardContent>

                  <div className="border-t border-border px-6 py-5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm text-ink-2">Total</span>
                      <span className="font-display text-2xl font-extrabold tabular-nums text-ink">
                        {formatLkr(rateTotal)}
                      </span>
                    </div>
                    <Button
                      size="lg"
                      loading={checkout.isPending}
                      onClick={() => {
                        if (checkout.isPending) return;
                        checkout.mutate();
                      }}
                      className="mt-4 w-full"
                    >
                      Confirm booking
                    </Button>
                  </div>
                </Card>

                <div className="mt-6 rounded-3xl border border-border bg-surface p-4 text-sm text-ink-2">
                  <Banknote className="mr-1 inline h-4 w-4" />
                  {onlineAvailable
                    ? "You chose pay-at-venue — your slot is confirmed immediately and you pay in cash at the venue."
                    : "Online payments are paused — you'll pay at the venue in cash once you confirm below."}
                </div>
              </>
            )}
          </>
        )}

        {renderVerifyModal()}
      </main>
    );
  }

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
            <DetailRow label="Venue" value={venueName || "—"} />
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

function MethodCard({
  icon,
  title,
  subtitle,
  active,
  disabled = false,
  badge,
  onClick,
  dataTestId
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  active: boolean;
  disabled?: boolean;
  badge?: string;
  onClick: () => void;
  dataTestId: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      data-testid={dataTestId}
      onClick={onClick}
      className={`flex items-start gap-3 rounded-3xl border p-4 text-left transition-colors ${
        disabled
          ? "cursor-not-allowed border-border bg-surface/60 opacity-60"
          : active
            ? "border-primary bg-primary-light/40 ring-1 ring-primary"
            : "border-border bg-surface hover:border-ink-3"
      }`}
    >
      <span className={`mt-0.5 ${disabled ? "text-ink-3" : active ? "text-primary" : "text-ink-3"}`}>{icon}</span>
      <span>
        <span className="flex items-center gap-2">
          <span className={`block font-semibold ${disabled ? "text-ink-2" : "text-ink"}`}>{title}</span>
          {badge && (
            <span className="rounded-full bg-ink-3/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-3">
              {badge}
            </span>
          )}
        </span>
        <span className="block text-sm text-ink-2">{subtitle}</span>
      </span>
    </button>
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