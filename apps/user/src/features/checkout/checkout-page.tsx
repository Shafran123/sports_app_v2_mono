"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Banknote, Clock, ShieldCheck, Wallet } from "lucide-react";
import { bookings, featureFlags, toApiFailure, venues } from "@myslot/api";
import { Badge, Button, Card, CardContent, CountdownPill, ErrorState, Skeleton } from "@myslot/ui";
import { formatDateLong, formatDuration, formatLkr, formatTime12, getRecaptchaToken, uuidV4 } from "@myslot/utils";
import { useAuth } from "@/context/auth";
import { currentHostname, isSiteHost } from "@/lib/site-host";
import { submitPayHere, startPayHereCheckout } from "@myslot/api";
import { VerifyPhoneModal } from "@/features/verify-phone/verify-phone-modal";
import { WidgetIdentity } from "@/features/widget/widget-identity";
import type { VenueOffer } from "@myslot/types";
import { applyVenueOffer } from "@/features/venue-detail/selection";

type PaymentMethod = "payhere" | "cash";

export function CheckoutPage({ venueId }: { venueId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
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
  const rawBasePricePerSlot = searchParams?.get("base_price_per_slot");
  const rawSlots = searchParams?.get("slots");
  const rawSlotMin = searchParams?.get("slot_min");
  const rawVenueOfferType = searchParams?.get("venue_offer_type");
  const rawVenueOfferValue = searchParams?.get("venue_offer_value");

  const incomplete = !courtId || !startAt || !endAt;
  // Dedicated Site context (ADR-0029/0030): on a live site host the checkout
  // (and its sign-in gate) carry the hostname so the server records the Site
  // Customer and validates the venue is the business's own live site.
  const siteHostname = isSiteHost(flags?.app_url) ? currentHostname() ?? undefined : undefined;

  const venueQuery = useQuery({
    queryKey: ["venue", venueId],
    queryFn: () => venues.detail(venueId),
    enabled: !incomplete
  });
  // ADR-0044: what this venue's Business offers is decided per Business —
  // the platform payhere_enabled flag stays as the global kill switch on top.
  const payhereAvailable =
    !!venueQuery.data?.payment_methods?.payhere_enabled &&
    !!venueQuery.data?.payment_methods?.payhere_configured &&
    payhereEnabled;
  const cashAvailable = !!venueQuery.data?.payment_methods?.cash_enabled;

  // Display names come from the query params built at the venue page; fall
  // back to the venue/court fetch so the confirmation never shows "—".
  const venueName = venueNameParam || venueQuery.data?.name || "";
  const courtName =
    courtNameParam ||
    venueQuery.data?.courts.find((c) => c.id === courtId)?.name ||
    "";
  const venueTaxRate = venueQuery.data?.venue_tax_rate ?? 0;

  const [method, setMethod] = React.useState<PaymentMethod>("payhere");
  const [chosen, setChosen] = React.useState(false);
  const [checkoutKey, setCheckoutKey] = React.useState(() => uuidV4());
  const [paying, setPaying] = React.useState(false);
  const [paymentPending, setPaymentPending] = React.useState(false);

  // The global kill switch forces cash only; otherwise the Business's own
  // config decides what the checkout offers.
  const onlineAvailable = payhereAvailable;
  const effectiveMethod: PaymentMethod = onlineAvailable ? method : cashAvailable ? "cash" : method;

  const checkout = useMutation({
    mutationFn: async () => {
      // Anti-bot Check (ticket 05): Dedicated Site checkouts carry a
      // reCAPTCHA token; the server rejects low-score bookings. Marketplace
      // and widget checkouts never mint one (ADR-0042).
      const captcha_token = siteHostname ? await getRecaptchaToken("site_checkout") : undefined;
      return bookings.checkout({
        court_id: courtId,
        start_at: startAt,
        end_at: endAt,
        idempotency_key: checkoutKey,
        payment_method: effectiveMethod,
        player_phone: user?.phone ?? undefined,
        // Dedicated Site context (ADR-0029): bookings made on a live site host
        // carry the hostname (the server validates it is the venue's own live
        // site and stores it for allowance/reporting context).
        site_hostname: siteHostname,
        captcha_token
      });
    }
  });

  // Onsite Checkout (ADR-0044 fast-follow): PayHere opens in-page, so the
  // confirmation arrives via the notify webhook instead of a redirect back.
  // While the payment is in flight we poll the player's bookings for this
  // venue and swap to the confirmation card (same component as pay-at-venue)
  // the moment the booking exists. This also recovers a redirect return: the
  // same slot/venue/time resolves to the paid booking, never a re-checkout.
  const slotKey = React.useMemo(
    () => `checkout-slot:${venueId}:${courtId}:${startAt}:${endAt}`,
    [venueId, courtId, startAt, endAt]
  );
  const [slotQueryKey, setSlotQueryKey] = React.useState(slotKey);
  const paidBookingQuery = useQuery({
    queryKey: ["checkout-paid", slotQueryKey],
    queryFn: async () => {
      const list = await bookings.list("upcoming", { venue_id: venueId });
      return list.find(
        (b) => b.court_id === courtId && b.start_at === startAt && b.end_at === endAt
      );
    },
    enabled: !!user && !!courtId,
    refetchInterval: paymentPending ? 2000 : false
  });
  const paidBooking = paidBookingQuery.data;

  React.useEffect(() => {
    if (!paidBooking || !paymentPending) return;
    setPaymentPending(false);
  }, [paidBooking, paymentPending]);

  const result = checkout.data;
  const isCash = !!result?.booking;
  const [secondsLeft, setSecondsLeft] = React.useState(0);
  const [expired, setExpired] = React.useState(false);

  React.useEffect(() => {
    if (incomplete || venueQuery.isLoading || !flags) return;
    // A guest has no account to verify against — the sign-in gate renders
    // below and the verify modal is never auto-opened for them (ADR-0030).
    if (!user) return;
    if (requiresVerification && !verified) {
      setVerifyOpen(true);
      return;
    }
    // When both methods are available, wait for the player to pick one.
    if (!chosen && cashAvailable && onlineAvailable) return;
    // With nothing enabled there is nothing to offer — the fail-closed card
    // renders and no request fires (ADR-0015).
    if (!onlineAvailable && !cashAvailable) return;
    // A cash booking is created server-side when it is confirmed, so it must
    // never auto-fire: it needs an explicit confirmation of the summary.
    if (effectiveMethod === "cash") return;
    // Recovery: when a paid booking already exists for this slot (a PayHere
    // return, or the webhook beat the client), show the confirmation card and
    // never mint a second checkout on the same slot. Wait for the recovery
    // query to settle before firing.
    if (paidBookingQuery.isLoading || paidBookingQuery.isFetching) return;
    if (paidBookingQuery.data) return;
    if (checkout.isPending) return;
    if (checkout.data || checkout.error) return;
    void checkout.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomplete, venueQuery.isLoading, flags, chosen, cashAvailable, method, checkoutKey, verified, onlineAvailable, requiresVerification, effectiveMethod, user, paidBookingQuery.isLoading, paidBookingQuery.isFetching, paidBookingQuery.data]);

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
    if (!onlineAvailable && next === "payhere") return;
    if (!cashAvailable && next === "cash") return;
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
    void startPayHereCheckout(result.payment_params, {
      first_name: user?.name,
      last_name: user?.name,
      email: user?.email,
      phone: user?.phone,
      city: user?.city
    }).then((onsite) => {
      if (onsite) {
        // The overlay opened in-page: the confirmation lands via the webhook
        // poll above — no redirect, no page navigation.
        setPaymentPending(true);
      } else {
        // Script failed to load: the hidden-form redirect fallback fired and
        // the page navigates away — the confirmation shows on the return.
        setPaying(false);
      }
    });
  };

  const payLabel = paying && !paymentPending ? "Opening PayHere…" : "Pay now";

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
    const needsEmail = failure?.code === "VERIFIED_EMAIL_REQUIRED";
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
        ) : needsEmail ? (
          <>
            <ErrorState
              title="Verify your email first"
              message="You need a verified email to book — your confirmation and check-in QR are sent there."
            />
            <div className="mt-6 flex justify-center">
              <Link
                href="/profile"
                className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 font-semibold text-surface transition-colors hover:bg-primary-hover"
              >
                Verify email
              </Link>
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
      <BookingConfirmationCard
        booking={result.booking}
        amount={result.amount}
        method="cash"
        venueName={venueName}
        courtName={courtName}
        startAt={startAt}
        endAt={endAt}
      />
    );
  }

  // PayHere confirmation (Onsite Checkout / webhook poll or a redirect return):
  // the same card component as pay-at-venue, so "Pay online" never strands the
  // customer on a second redirect — the paid booking resolves in place.
  const showPaidBooking = paidBooking && (effectiveMethod === "payhere" || paymentPending);
  if (showPaidBooking) {
    return (
      <BookingConfirmationCard
        booking={paidBooking!}
        amount={paidBooking!.total_price}
        method="payhere"
        venueName={venueName}
        courtName={courtName}
        startAt={startAt}
        endAt={endAt}
      />
    );
  }

  const pricePerSlot = rawPricePerSlot ? Number(rawPricePerSlot) : null;
  const basePricePerSlot = rawBasePricePerSlot ? Number(rawBasePricePerSlot) : null;
  const durationMin = rawSlotMin ? Number(rawSlotMin) : null;
  const slotsCount = rawSlots
    ? Number(rawSlots)
    : pricePerSlot && pricePerSlot > 0 && result?.amount
      ? Math.max(1, Math.round(result.amount / pricePerSlot))
      : null;
  const rateLine =
    durationMin && durationMin > 0
      ? `${formatDuration(durationMin)} × ${formatLkr(pricePerSlot ?? 0)}`
      : slotsCount && pricePerSlot
        ? `${slotsCount} × ${formatLkr(pricePerSlot)}`
        : pricePerSlot
          ? formatLkr(pricePerSlot)
          : null;
  // The server is authoritative for what the player pays (offers, variable
  // pricing, tax carve-out). The URL-derived rate is only a display fallback.
  const serverTotal = result?.amount ?? null;
  const baseTotal = slotsCount && basePricePerSlot ? slotsCount * basePricePerSlot : null;
  const savings = serverTotal != null && baseTotal != null && baseTotal > serverTotal
    ? baseTotal - serverTotal
    : 0;

  // Venue-wide offer carried from the venue page (availability.venue_offer).
  // Pre-checkout the server hasn't priced yet (cash doesn't auto-fire), so we
  // show the venue-wide-discounted total for display; the server amount wins
  // once the checkout responds.
  const venueOffer: VenueOffer | null =
    (rawVenueOfferType === "percent" || rawVenueOfferType === "flat") && rawVenueOfferValue
      ? { discount_type: rawVenueOfferType, value: Number(rawVenueOfferValue) }
      : null;
  const displaySubtotal = slotsCount && pricePerSlot ? slotsCount * pricePerSlot : 0;
  const venueOfferAdj = applyVenueOffer(displaySubtotal, venueOffer);
  const displayTotal = serverTotal ?? venueOfferAdj.total;

  // Identity gate (ADR-0030): a guest lands on the sign-in flow, and on a
  // live site host a Site Customer stays on it until BOTH phone and email are
  // verified — the server rejects a site booking with a missing verified email
  // (VERIFIED_EMAIL_REQUIRED), and the fallback platform verify-email modal
  // 500s on a site customer's id. The platform verify modal (which writes
  // OTPs against the `users` table) must never fire for them.
  const siteHostActive = Boolean(siteHostname);
  const verifiedPhone = !!user?.phone_verified_at;
  const verifiedEmail = !!user?.email_verified_at;
  const gateActive =
    !user ||
    (siteHostActive && requiresVerification && (!verifiedPhone || !verifiedEmail));
  if (gateActive) {
    if (loading || !flags) {
      return (
        <main className="mx-auto max-w-3xl px-4 pb-24 pt-8">
          <Skeleton className="h-6 w-40" />
          <div className="mt-6 space-y-3">
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-11 w-full rounded-full" />
          </div>
        </main>
      );
    }
    return (
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-8">
        <Link
          href={venueHref}
          className="press inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          {venueName || "Back to venue"}
        </Link>
        <div className="mt-5 rounded-3xl border border-border bg-surface p-6 shadow-soft md:p-8">
          <p className="text-sm text-ink-2">
            Your booking is saved in the link — sign in to confirm your slot.
          </p>
          <div className="mt-5">
            <WidgetIdentity siteHostname={siteHostname} siteName={venueQuery.data?.business_name ?? null} onDone={() => {}} />
          </div>
        </div>
      </main>
    );
  }

  if (!result) {
    const noMethodsAvailable = !onlineAvailable && !cashAvailable;
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

        {noMethodsAvailable ? (
          <Card className="mt-6 p-6">
            <h2 className="font-semibold text-ink">No payment methods available</h2>
            <p className="mt-1 text-sm text-ink-2">
              This venue is not accepting bookings right now. Check back soon, or contact the venue
              directly.
            </p>
            <Button variant="secondary" className="mt-4" onClick={() => router.push(venueHref)}>
              Back to venue
            </Button>
          </Card>
        ) : (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Payment method">
              <MethodCard
                icon={<Wallet className="h-5 w-5" />}
                title="Pay online"
                subtitle={onlineAvailable ? "PayHere · instant confirmation" : "Temporarily unavailable"}
                badge={onlineAvailable ? undefined : "Unavailable"}
                active={onlineAvailable && method === "payhere"}
                disabled={!onlineAvailable}
                onClick={() => chooseMethod("payhere")}
                dataTestId="method-online"
              />
              <MethodCard
                icon={<Banknote className="h-5 w-5" />}
                title="Pay at venue"
                subtitle={cashAvailable ? "Cash on arrival" : "Temporarily unavailable"}
                badge={cashAvailable ? undefined : "Unavailable"}
                active={effectiveMethod === "cash"}
                disabled={!cashAvailable}
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
                        {formatLkr(displayTotal)}
                      </span>
                    </div>
                    {venueOffer && (
                      <p className="mt-1 text-xs font-medium text-success">
                        {venueOffer.discount_type === "percent"
                          ? `Venue-wide ${venueOffer.value}% off — you save ${formatLkr(venueOfferAdj.discount)}`
                          : `Venue-wide offer — you save ${formatLkr(venueOfferAdj.discount)}`}
                      </p>
                    )}
                    {savings > 0 && (
                      <p className="mt-1 text-xs font-medium text-success">
                        You saved {formatLkr(savings)} — {formatLkr(baseTotal ?? 0)} originally
                      </p>
                    )}
                    {venueTaxRate > 0 && (
                      <p className="mt-1 text-xs text-ink-3">
                        Total includes {venueTaxRate}% Venue Tax and the platform tax.
                      </p>
                    )}
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
                    : "Online payment is unavailable here — you'll pay at the venue in cash once you confirm below."}
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
          {venueOffer && (
            <p className="mt-1 text-xs font-medium text-success">
              {venueOffer.discount_type === "percent"
                ? `Venue-wide ${venueOffer.value}% off — you save ${formatLkr(venueOfferAdj.discount)}`
                : `Venue-wide offer — you save ${formatLkr(venueOfferAdj.discount)}`}
            </p>
          )}
          {savings > 0 && (
            <p className="mt-1 text-xs font-medium text-success">
              You saved {formatLkr(savings)} — {formatLkr(baseTotal ?? 0)} originally
            </p>
          )}
          {paymentPending ? (
            <div className="mt-4 w-full rounded-2xl bg-surface px-6 py-4 text-center">
              <p className="font-semibold text-ink">Confirming your payment…</p>
              <p className="mt-1 text-sm text-ink-2">
                We&apos;re waiting for PayHere&apos;s confirmation. This page updates automatically —
                no need to do anything.
              </p>
            </div>
          ) : (
            <Button
              size="lg"
              loading={paying}
              disabled={expired}
              onClick={handlePay}
              className="mt-4 hidden w-full md:inline-flex"
            >
              {payLabel}
            </Button>
          )}
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
        PayHere opens in this page — you never leave the site (sandbox).
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
          {paymentPending ? (
            <div className="min-w-0 flex-1 text-right">
              <p className="text-xs font-semibold text-ink">Confirming your payment…</p>
            </div>
          ) : (
            <Button size="lg" loading={paying} disabled={expired} onClick={handlePay} className="min-w-44 flex-1">
              {payLabel}
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}

// The shared post-booking confirmation card — used identically by pay-at-venue
// and pay-online (the paid booking resolves in place after Onsite Checkout).
function BookingConfirmationCard({
  booking,
  amount,
  method,
  venueName,
  courtName,
  startAt,
  endAt
}: {
  booking: { id: string; status: string };
  amount: number;
  method: "cash" | "payhere";
  venueName: string;
  courtName: string;
  startAt: string;
  endAt: string;
}) {
  const router = useRouter();
  const confirmed = booking.status === "confirmed";
  const online = method === "payhere";
  return (
    <main className="mx-auto max-w-3xl px-4 pb-32 pt-8 md:pb-14">
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">
        {confirmed ? "Booking confirmed" : "Booking pending"}
      </h1>
      <Card className="mt-6 overflow-hidden">
        <CardContent className="px-6 py-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-primary">
            {confirmed ? <Banknote className="h-7 w-7" /> : <Clock className="h-7 w-7" />}
          </div>
          <h2 className="mt-4 font-display text-xl font-extrabold text-ink">
            {confirmed
              ? online
                ? "Payment received"
                : "Pay on arrival"
              : "Awaiting confirmation"}
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            {confirmed ? (
              online ? (
                <>
                  Your slot is locked in. We&apos;ve emailed your confirmation — show the QR code at
                  check-in.
                </>
              ) : (
                <>
                  Your slot is locked in. Pay{" "}
                  <span className="font-semibold text-ink">{formatLkr(amount)}</span> at the venue.
                </>
              )
            ) : (
              <>
                The venue is confirming your slot — pay{" "}
                <span className="font-semibold text-ink">{formatLkr(amount)}</span>
                {online ? " online." : " at the venue when you arrive."} We&apos;ll email you the
                moment it&apos;s confirmed.
              </>
            )}
          </p>
          <dl className="mx-auto mt-5 max-w-sm space-y-2 text-left text-sm">
            <DetailRow label="Venue" value={venueName || "—"} />
            <DetailRow label="Court" value={courtName || "Court"} />
            <DetailRow label="Date" value={formatDateLong(startAt)} />
            <DetailRow label="Time" value={`${formatTime12(startAt)} – ${formatTime12(endAt)}`} />
          </dl>
          <Button
            size="lg"
            className="mt-6 w-full"
            onClick={() => router.push(`/bookings/${booking.id}`)}
          >
            {confirmed ? "View booking & QR code" : "View booking & confirmation"}
          </Button>
        </CardContent>
      </Card>
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