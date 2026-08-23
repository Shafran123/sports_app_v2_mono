"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ownerOnboarding, toApiFailure } from "@myslot/api";
import { Button, Card, EmptyState, PasswordInput } from "@myslot/ui";
import { formatLkr } from "@myslot/utils";
import { useAuth } from "@/context/auth";

export function PlanPage() {
  const { setUser, user } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = React.useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["owner-plan"],
    queryFn: () => ownerOnboarding.myPlan()
  });

  const pendingAgreement = data?.agreements.find((a) => a.status === "pending");

  const accept = useMutation({
    mutationFn: () => ownerOnboarding.acceptAgreement(pendingAgreement!.id),
    onSuccess: async () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["owner-plan"] });
      const { auth } = await import("@myslot/api");
      const me = await auth.me();
      setUser(me);
    },
    onError: (e) => setError(toApiFailure(e)?.message ?? "Could not accept the agreement.")
  });

  const decline = useMutation({
    mutationFn: () => ownerOnboarding.declineAgreement(pendingAgreement!.id),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["owner-plan"] });
    },
    onError: (e) => setError(toApiFailure(e)?.message ?? "Could not decline the agreement.")
  });

  async function openPdf(id: string) {
    const win = window.open("about:blank", "_blank");
    if (!win) {
      setError("Your browser blocked the PDF tab. Allow popups for this app and try again.");
      return;
    }
    setPdfBusy(true);
    try {
      const { ownerOnboarding } = await import("@myslot/api");
      const blob = await ownerOnboarding.agreementPdf(id);
      win.location.replace(URL.createObjectURL(blob));
    } catch (e) {
      win.close();
      setError(toApiFailure(e)?.message ?? "Could not load the PDF.");
    } finally {
      setPdfBusy(false);
    }
  }

  if (isLoading) {
    return <Card className="p-6"><div className="skeleton h-64 rounded-2xl" /></Card>;
  }

  if (isError || !data) {
    return (
      <EmptyState
        title="Could not load your plan"
        message="Your plan details are unavailable right now."
        actionLabel="Retry"
        onAction={() => refetch()}
      />
    );
  }

  const bank = data.bank_details ?? {};
  const grandfathered = user?.onboarding_state === "grandfathered";
  const mustChange = user?.must_change_password === true;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">Plan &amp; agreement</h1>
        <p className="mt-1 text-sm text-ink-2">Your commercial terms with the platform.</p>
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-error">{error}</p>}

      {grandfathered && (
        <Card className="border-amber-200 bg-amber-50/60 p-6">
          <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">Set up your plan</h2>
          <p className="mt-1 text-sm text-ink-2">
            Your account predates owner onboarding. Contact the platform team to attach a plan and
            agreement — your venue stays live in the meantime.
          </p>
        </Card>
      )}

      {mustChange && (
        <PasswordChangeCard onDone={async () => {
          setError(null);
          const { auth } = await import("@myslot/api");
          setUser(await auth.me());
        }} onError={setError} />
      )}

      {pendingAgreement && (
        <Card className="border-amber-200 bg-amber-50/60 p-6">
          <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">{pendingAgreement.title}</h2>
          <p className="mt-1 text-sm text-ink-2">Pending your acceptance{pendingAgreement.plan_name ? ` — plan: ${pendingAgreement.plan_name}` : ""}.</p>
          <div className="mt-4 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-2xl bg-surface p-4 text-sm text-ink-2">
            {pendingAgreement.body}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => accept.mutate()} disabled={accept.isPending}>
              {accept.isPending ? "Accepting…" : "I accept the agreement"}
            </Button>
            <Button variant="secondary" onClick={() => decline.mutate()} disabled={decline.isPending}>
              Decline
            </Button>
            <Button variant="secondary" onClick={() => openPdf(pendingAgreement.id)} disabled={pdfBusy}>
              {pdfBusy ? "Preparing…" : "Download PDF"}
            </Button>
          </div>
        </Card>
      )}

      {data.plans.length === 0 ? (
        <Card className="p-6">
          <p className="text-sm text-ink-2">No plan attached yet. Contact the platform team to set up your plan.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.plans.map((plan) => (
            <Card key={plan.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{plan.name}</p>
                  <p className="mt-1 text-sm text-ink-2">
                    {plan.start_date} → {plan.end_date} • {plan.term_days} days
                  </p>
                </div>
                <span className="rounded-full bg-surface-2 px-3 py-1 text-sm font-semibold text-ink">
                  {plan.price_lkr > 0 ? formatLkr(plan.price_lkr) : "Free"}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-6">
        <h2 className="font-semibold text-ink">Payment details</h2>
        <p className="mt-1 text-sm text-ink-2">Plan fees are settled by bank transfer — details below.</p>
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {bank.bank ? <p><strong>Bank:</strong> {bank.bank}</p> : null}
          {bank.account_name ? <p><strong>Account name:</strong> {bank.account_name}</p> : null}
          {bank.account_number ? <p><strong>Account number:</strong> {bank.account_number}</p> : null}
          {bank.branch ? <p><strong>Branch:</strong> {bank.branch}</p> : null}
          {!bank.bank && !bank.account_number && <p className="text-ink-3">No payment details configured yet.</p>}
        </div>
      </Card>

      {data.agreements.length > 0 && (
        <Card className="p-6">
          <h2 className="font-semibold text-ink">Agreement history</h2>
          <ul className="mt-3 divide-y divide-border">
            {data.agreements.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{a.title}</p>
                  <p className="text-sm text-ink-2">
                    {new Date(a.created_at!).toLocaleDateString()} •{" "}
                    {a.status === "accepted" ? `Accepted ${a.accepted_at ? new Date(a.accepted_at).toLocaleDateString() : ""}` : a.status}
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => openPdf(a.id)} disabled={pdfBusy}>
                  {pdfBusy ? "Preparing…" : "PDF"}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function PasswordChangeCard({ onDone, onError }: { onDone: () => void; onError: (e: string | null) => void }) {
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const change = useMutation({
    mutationFn: async () => {
      if (password.length < 8) throw new Error("Password must be at least 8 characters.");
      if (password !== confirm) throw new Error("Passwords do not match.");
      const { changePassword } = await import("@myslot/auth");
      await changePassword(password);
      await ownerOnboarding.passwordChanged();
    },
    onSuccess: () => {
      setError(null);
      setPassword("");
      setConfirm("");
      onError(null);
      onDone();
    },
    onError: (e) => setError(e instanceof Error ? e.message : toApiFailure(e)?.message ?? "Could not change your password.")
  });

  return (
    <Card className="border-primary/40 bg-primary-light/40 p-6">
      <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">Set a new password</h2>
      <p className="mt-1 text-sm text-ink-2">
        The temporary password sent to you must be changed before you continue.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="new-password" className="text-xs font-semibold uppercase tracking-wide text-ink-3">New password</label>
          <PasswordInput id="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="confirm-password" className="text-xs font-semibold uppercase tracking-wide text-ink-3">Confirm password</label>
          <PasswordInput id="confirm-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
      </div>
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-error">{error}</p>}
      <div className="mt-5">
        <Button onClick={() => change.mutate()} disabled={change.isPending || !password || !confirm}>
          {change.isPending ? "Updating…" : "Change password"}
        </Button>
      </div>
    </Card>
  );
}