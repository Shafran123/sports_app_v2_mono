"use client";

// Staff queue for Dedicated Site requests (ADR-0029): approve hostnames, hand
// over DNS, run automated verification, complete the checklist, and mark the
// site live — with a rejection path that emails the owner. The owner runs the
// same request from the "Widget & site" console.

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { admin, toApiFailure } from "@myslot/api";
import { Badge, Button, Card, Dialog, DialogContent, EmptyState, ErrorState, Textarea } from "@myslot/ui";
import type { SiteRequest } from "@myslot/types";

const STATUS_ORDER = ["requested", "approved", "dns_pending", "verifying", "live", "rejected"] as const;
const STATUS_LABELS: Record<string, string> = {
  requested: "Requested",
  approved: "Approved — DNS",
  dns_pending: "DNS record added",
  verifying: "Verifying",
  live: "Live",
  rejected: "Rejected"
};

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "live"
      ? "success"
      : status === "rejected"
        ? "error"
        : status === "verifying"
          ? "warning"
          : "neutral";
  return <Badge variant={tone as "success" | "error" | "warning" | "neutral"}>{STATUS_LABELS[status] ?? status}</Badge>;
}

export function SitesPage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<SiteRequest | null>(null);

  const sitesQuery = useQuery({
    queryKey: ["admin-site-requests"],
    queryFn: () => admin.siteRequests()
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-site-requests"] });

  const sites = sitesQuery.data ?? [];
  const ordered = useMemo(
    () =>
      [...sites].sort((a, b) => {
        const ai = STATUS_ORDER.indexOf(a.status as never);
        const bi = STATUS_ORDER.indexOf(b.status as never);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || String(b.created_at).localeCompare(String(a.created_at));
      }),
    [sites]
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">Sites</h1>
        <p className="mt-1 text-sm text-ink-2">
          Dedicated Site hostname requests run the white-label on the owner&apos;s own domain. Approve, watch DNS
          verification, and mark live when the checklist is done.
        </p>
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-error">{error}</p>}

      {sitesQuery.isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Card key={i} className="p-5"><div className="skeleton h-40 rounded-2xl" /></Card>
          ))}
        </div>
      ) : sitesQuery.isError ? (
        <ErrorState title="Could not load site requests" onRetry={() => sitesQuery.refetch()} />
      ) : ordered.length === 0 ? (
        <EmptyState title="No site requests" message="Owners' dedicated-site requests appear here." />
      ) : (
        <div className="space-y-4">
          {ordered.map((req) => (
            <SiteRequestCard
              key={req.id}
              req={req}
              onError={setError}
              onDone={invalidate}
              onReject={() => setRejecting(req)}
            />
          ))}
        </div>
      )}

      <RejectDialog request={rejecting} onClose={() => setRejecting(null)} onDone={() => { setRejecting(null); invalidate(); }} onError={setError} />
    </div>
  );
}

function SiteRequestCard({
  req,
  onError,
  onDone,
  onReject
}: {
  req: SiteRequest;
  onError: (m: string) => void;
  onDone: () => void;
  onReject: () => void;
}) {
  const run = (fn: () => Promise<unknown>) => async () => {
    try {
      await fn();
      onDone();
    } catch (e) {
      onError(toApiFailure(e).message);
    }
  };
  const { busy, track } = useBusy();

  const checklistDone = (req.checklist ?? []).filter((c) => c.done).length;
  const checklistTotal = (req.checklist ?? []).length;
  const live = req.status === "live";

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">{req.business_name}</h2>
            <Badge variant="neutral">{req.hostname_kind === "subdomain" ? "Platform subdomain" : "Owner domain"}</Badge>
            <StatusBadge status={req.status} />
          </div>
          <p className="mt-1 font-mono text-sm text-ink-2">
            {req.display_hostname ?? req.hostname}
            <span className="ml-2 text-ink-3">{req.venue_count ?? 0} venue{req.venue_count === 1 ? "" : "s"}</span>
          </p>
          <p className="mt-0.5 text-xs text-ink-3">
            {req.owner_name || "Owner"} — {req.owner_email}
          </p>
          {req.status === "rejected" && req.rejection_reason && (
            <p className="mt-2 rounded-xl bg-error-light px-3 py-2 text-sm text-error">
              Rejected: {req.rejection_reason}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {req.status === "requested" && (
            <>
              <Button size="sm" loading={busy.approve} onClick={track("approve", run(() => admin.approveSiteRequest(req.id)))}>
                Approve
              </Button>
              <Button size="sm" variant="secondary" onClick={onReject}>Reject</Button>
            </>
          )}
          {["approved", "dns_pending"].includes(req.status) && (
            <Button size="sm" loading={busy.verify} onClick={track("verify", run(() => admin.verifySiteRequest(req.id)))}>
              Run DNS verification
            </Button>
          )}
          {req.status === "verifying" && (
            <Button size="sm" variant="primary" loading={busy.live} onClick={track("live", run(() => admin.markSiteLive(req.id)))}>
              Mark live
            </Button>
          )}
          {!live && req.status !== "rejected" && (
            <Button size="sm" variant="secondary" onClick={onReject}>Reject</Button>
          )}
        </div>
      </div>

      {req.status !== "requested" && req.status !== "rejected" && req.dns_name && req.dns_value && (
        <div className="mt-4 rounded-2xl bg-surface-2 px-4 py-3 text-xs text-ink-2">
          <p className="font-semibold uppercase tracking-wider text-ink-3">DNS hand-off</p>
          <p className="mt-1 font-mono">
            Type <span className="font-bold text-ink">{req.dns_type}</span> — Name{" "}
            <span className="font-bold text-ink">{req.dns_name}</span> — Value{" "}
            <span className="font-bold text-ink">{req.dns_value}</span>
          </p>
        </div>
      )}

      {!live && req.status !== "requested" && req.status !== "rejected" && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">
            Staff checklist — {checklistDone}/{checklistTotal}
          </p>
          <div className="mt-2 space-y-1.5">
            {(req.checklist ?? []).map((item) => (
              <label key={item.key} className="flex items-center gap-2 text-sm text-ink-2">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={async (e) => {
                    try {
                      await admin.setSiteChecklist(req.id, item.key, e.target.checked);
                      onDone();
                    } catch (err) {
                      onError(toApiFailure(err).message);
                    }
                  }}
                  className="h-4 w-4 rounded"
                />
                {item.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function useBusy() {
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  return {
    busy,
    track: (key: string, fn: () => Promise<void>) => async () => {
      setBusy((b) => ({ ...b, [key]: true }));
      try {
        await fn();
      } finally {
        setBusy((b) => ({ ...b, [key]: false }));
      }
    }
  };
}

function RejectDialog({
  request,
  onClose,
  onDone,
  onError
}: {
  request: SiteRequest | null;
  onClose: () => void;
  onDone: () => void;
  onError: (m: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const open = !!request;

  const submit = async () => {
    if (!request) return;
    setSubmitting(true);
    try {
      await admin.rejectSiteRequest(request.id, reason);
      setReason("");
      onDone();
    } catch (e) {
      onError(toApiFailure(e).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Reject site request" className="max-w-md">
        <p className="text-sm text-ink-2">
          The owner is emailed immediately. They can edit and re-request from their console.
        </p>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why isn't this hostname approved?"
          className="mt-3"
          rows={3}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="destructive" onClick={submit} loading={submitting} disabled={!reason.trim()}>Reject &amp; email</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}