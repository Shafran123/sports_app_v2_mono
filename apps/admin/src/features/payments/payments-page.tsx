"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, CreditCard, KeyRound, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { admin, business, toApiFailure } from "@myslot/api";
import { Badge, Button, Card, Skeleton } from "@myslot/ui";
import type { PaymentMethods } from "@myslot/types";
import { useAuth } from "@/context/auth";

// Payments (ADR-0044): the owner console page for payment methods. Cash and
// PayHere toggles live here with the PayHere credential entry — one page for
// everything (Q11/Q36). At least one method must stay enabled (Q19);
// disabling keeps credentials, "Remove keys" deletes them outright (Q14).
export function PaymentsPage() {
  const { user } = useAuth();
  if (user?.role === "admin") return <AdminPaymentSummary />;
  return <OwnerPayments />;
}

function OwnerPayments() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: () => business.getPaymentMethods()
  });

  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [merchantId, setMerchantId] = React.useState("");
  const [merchantSecret, setMerchantSecret] = React.useState("");
  const [appId, setAppId] = React.useState("");
  const [appSecret, setAppSecret] = React.useState("");
  const [confirmRemove, setConfirmRemove] = React.useState(false);

  const applyError = (e: unknown, fallback: string) =>
    setError(toApiFailure(e)?.message ?? fallback);

  const toggle = useMutation({
    mutationFn: (patch: { cash?: boolean; payhere?: boolean }) =>
      business.updatePaymentMethods(patch),
    onSuccess: (next) => {
      queryClient.setQueryData(["payment-methods"], next);
      setError(null);
    },
    onError: (e) => applyError(e, "Could not update payment methods.")
  });

  const saveCreds = useMutation({
    mutationFn: () =>
      business.savePayhereCredentials({ merchant_id: merchantId, merchant_secret: merchantSecret, app_id: appId, app_secret: appSecret }),
    onSuccess: (next) => {
      queryClient.setQueryData(["payment-methods"], next);
      setError(null);
      setSaved(true);
      setShowForm(false);
      setMerchantId("");
      setMerchantSecret("");
      setAppId("");
      setAppSecret("");
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (e) => applyError(e, "Could not save PayHere credentials.")
  });

  const removeCreds = useMutation({
    mutationFn: () => business.removePayhereCredentials(),
    onSuccess: (next) => {
      queryClient.setQueryData(["payment-methods"], next);
      setError(null);
      setConfirmRemove(false);
    },
    onError: (e) => applyError(e, "Could not remove PayHere credentials.")
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Payments</h1>
          <p className="mt-1 text-sm text-ink-2">How your customers pay — cash at the venue, or online via PayHere.</p>
        </div>
        <Skeleton className="h-48 w-full rounded-3xl" />
        <Skeleton className="h-48 w-full rounded-3xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Payments</h1>
          <p className="mt-1 text-sm text-ink-2">How your customers pay — cash at the venue, or online via PayHere.</p>
        </div>
        <Card className="p-5 md:p-6">
          <p className="text-sm text-ink-2">Could not load payment methods.</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => refetch()}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  const payhere = data.payhere;
  const bothOff = !data.cash.enabled && !payhere.enabled;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Payments</h1>
        <p className="mt-1 text-sm text-ink-2">
          How your customers pay — cash at the venue, or online via PayHere. At least one method must
          stay enabled.
        </p>
      </div>

      {bothOff && (
        <div className="rounded-3xl border border-warning/40 bg-warning-light px-4 py-3 text-sm font-medium">
          No payment methods are enabled — customers can&apos;t book until you turn one on.
        </div>
      )}

      {error && <p className="rounded-2xl bg-error-light p-3 text-sm text-error">{error}</p>}
      {saved && <p className="text-sm text-success">PayHere credentials saved.</p>}

      <Card className="p-5 md:p-6">
        <MethodHeader
          icon={<Banknote className="h-5 w-5" />}
          title="Cash at the venue"
          subtitle="Customers pay in cash when they arrive. You record collection from the booking."
        />
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-ink-2">Accept cash payments</p>
          <button
            type="button"
            role="switch"
            aria-checked={data.cash.enabled}
            aria-label="Accept cash payments"
            onClick={() => {
              if (toggle.isPending) return;
              if (data.cash.enabled && !payhere.enabled) {
                setError("At least one payment method must stay enabled — turn on PayHere first.");
                return;
              }
              toggle.mutate({ cash: !data.cash.enabled });
            }}
            className="shrink-0"
          >
            {data.cash.enabled ? <ToggleRight className="h-8 w-8 text-primary" /> : <ToggleLeft className="h-8 w-8 text-ink-3" />}
          </button>
        </div>
      </Card>

      <Card className="p-5 md:p-6">
        <MethodHeader
          icon={<CreditCard className="h-5 w-5" />}
          title="PayHere (online card payments)"
          subtitle="Customers pay by card online. Money lands directly in your PayHere account — the platform never touches it."
          state={payhereStateBadge(payhere)}
        />

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-ink-2">Accept online payments</p>
          <button
            type="button"
            role="switch"
            aria-checked={payhere.enabled}
            aria-label="Accept PayHere payments"
            onClick={() => {
              if (toggle.isPending) return;
              if (!payhere.enabled && !payhere.configured) {
                setError("Save your PayHere credentials before enabling PayHere.");
                return;
              }
              if (payhere.enabled && !data.cash.enabled) {
                setError("At least one payment method must stay enabled — turn on cash first.");
                return;
              }
              toggle.mutate({ payhere: !payhere.enabled });
            }}
            className="shrink-0"
          >
            {payhere.enabled ? <ToggleRight className="h-8 w-8 text-primary" /> : <ToggleLeft className="h-8 w-8 text-ink-3" />}
          </button>
        </div>

        <div className="mt-6 border-t border-border pt-5">
          {payhere.configured ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-ink">PayHere connected</span>
                <Badge variant="success">{payhereStateBadge(payhere)}</Badge>
                {payhere.app_last4 && (
                  <span className="text-ink-3">App ID ••••{payhere.app_last4}</span>
                )}
              </div>
              <p className="max-w-xl text-sm text-ink-2">
                {payhere.enabled
                  ? "Checkout will offer PayHere to your customers. Note: PayHere approves the merchant secret per embedding domain — widget payments may take up to 24 hours to activate."
                  : "Credentials are saved but PayHere is off — flip the toggle above to offer it at checkout."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowForm(!showForm)}>
                  <KeyRound className="mr-1.5 h-4 w-4" /> Update credentials
                </Button>
                {confirmRemove ? (
                  <span className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setConfirmRemove(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      loading={removeCreds.isPending}
                      onClick={() => removeCreds.mutate()}
                    >
                      Confirm remove
                    </Button>
                  </span>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => setConfirmRemove(true)} className="text-error">
                    <Trash2 className="mr-1.5 h-4 w-4" /> Remove keys
                  </Button>
                )}
              </div>
              {confirmRemove && (
                <p className="max-w-xl text-sm text-ink-2">
                  This deletes your stored PayHere credentials entirely and turns PayHere off. If a
                  refund is still owed after removal, it escalates to the platform team.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="max-w-xl text-sm text-ink-2">
                Add your PayHere merchant credentials — you&apos;ll find them in your PayHere dashboard
                (merchant ID + merchant secret for checkout, app ID + app secret for refunds). The
                secrets are encrypted — only the last 4 characters of the app ID are ever shown again.
              </p>
              {showForm && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Merchant ID" value={merchantId} onChange={setMerchantId} placeholder="12xxxx" />
                  <Field label="Merchant secret" type="password" value={merchantSecret} onChange={setMerchantSecret} placeholder="••••••••" />
                  <Field label="App ID" value={appId} onChange={setAppId} placeholder="9xxxxx" />
                  <Field label="App secret" type="password" value={appSecret} onChange={setAppSecret} placeholder="••••••••" />
                </div>
              )}
              <Button
                variant="primary"
                size="sm"
                loading={saveCreds.isPending}
                disabled={showForm && (!merchantId || !merchantSecret || !appId || !appSecret)}
                onClick={() => {
                  if (!showForm) setShowForm(true);
                  else saveCreds.mutate();
                }}
              >
                {showForm ? "Save credentials" : "Add credentials"}
              </Button>
              {showForm && (
                <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function payhereStateBadge(payhere: PaymentMethods["payhere"]): string {
  if (!payhere.configured) return "Not configured";
  if (payhere.state === "configured") return "Connected";
  return "Connected — awaiting first payment";
}

function MethodHeader({
  icon,
  title,
  subtitle,
  state
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  state?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-primary">{icon}</span>
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-medium text-ink">
          {title}
          {state && <Badge variant={state === "Connected" ? "success" : "neutral"}>{state}</Badge>}
        </p>
        <p className="mt-0.5 max-w-xl text-sm text-ink-2">{subtitle}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink-2">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink"
        autoComplete="off"
        spellCheck={false}
      />
    </label>
  );
}

function AdminPaymentSummary() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-payment-summary"],
    queryFn: () => admin.paymentSummary()
  });

  if (isLoading) return <Skeleton className="h-64 w-full rounded-3xl" />;
  if (isError || !data) {
    return (
      <Card className="p-5 md:p-6">
        <p className="text-sm text-ink-2">Could not load the payment summary.</p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => refetch()}>
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Payments</h1>
        <p className="mt-1 text-sm text-ink-2">
          Read-only overview of each business&apos;s payment configuration and PayHere collections.
          Money sits in the owners&apos; PayHere accounts — this is informational.
        </p>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-2 text-xs uppercase tracking-wide text-ink-3">
              <tr>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Cash</th>
                <th className="px-4 py-3">PayHere</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">App ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.businesses.map((b) => (
                <tr key={b.business_id}>
                  <td className="px-4 py-3 font-medium text-ink">{b.business_name}</td>
                  <td className="px-4 py-3">
                    {b.cash_enabled ? <Badge variant="success">On</Badge> : <Badge variant="neutral">Off</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    {b.payhere_enabled ? <Badge variant="success">On</Badge> : <Badge variant="neutral">Off</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    {b.payhere_configured ? <Badge variant="success">Configured</Badge> : <Badge variant="neutral">Not configured</Badge>}
                  </td>
                  <td className="px-4 py-3 text-ink-2">{b.app_id_last4 ? `••••${b.app_id_last4}` : "—"}</td>
                </tr>
              ))}
              {data.businesses.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-ink-3">
                    No businesses yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {data.collection.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-4 py-3">
            <p className="font-medium text-ink">PayHere collections (last 90 days)</p>
            <p className="text-xs text-ink-2">Net revenue after tax, per business per day.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface-2 text-xs uppercase tracking-wide text-ink-3">
                <tr>
                  <th className="px-4 py-3">Day</th>
                  <th className="px-4 py-3">Payments</th>
                  <th className="px-4 py-3">Net revenue (LKR)</th>
                  <th className="px-4 py-3">Tax (LKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.collection.map((c, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3">{c.day}</td>
                    <td className="px-4 py-3">{c.payhere_payments}</td>
                    <td className="px-4 py-3">{c.payhere_revenue_net.toLocaleString()}</td>
                    <td className="px-4 py-3">{c.payhere_tax.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}