"use client";

// Owner console: the Dedicated Site section (ADR-0029). Request a site
// hostname (your own domain or a myslot.lk subdomain), follow the DNS
// hand-off, watch the status, and re-request after a rejection. Every status
// change also emails the owner.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { business, toApiFailure } from "@myslot/api";
import { Badge, Button, Card, ErrorState, Input, SelectSheet } from "@myslot/ui";
import { cn } from "@myslot/utils";
import { Globe, RotateCcw } from "lucide-react";
import type { SiteRequest } from "@myslot/types";

const STEPS = ["requested", "approved", "dns_pending", "verifying", "live"];
const STEP_LABELS: Record<string, string> = {
  requested: "Submitted",
  approved: "Approved",
  dns_pending: "DNS added",
  verifying: "Verifying",
  live: "Live"
};

export function SiteRequestSection() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["site-request"],
    queryFn: () => business.siteRequest()
  });

  if (query.isLoading) {
    return <Card className="p-5"><div className="skeleton h-28 rounded-2xl" /></Card>;
  }
  if (query.isError) {
    return (
      <Card className="p-5">
        <ErrorState title="Could not load your site request" onRetry={() => query.refetch()} />
      </Card>
    );
  }

  const req = query.data && "id" in query.data && query.data.id ? (query.data as SiteRequest) : null;

  const onError = (e: unknown) => {
    setError(toApiFailure(e).message);
    setNotice(null);
  };
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["site-request"] });

  return (
    <Card className="p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight text-ink">
            <Globe className="h-5 w-5 text-ink-3" /> Dedicated site
          </h2>
          <p className="mt-0.5 text-sm text-ink-2">
            Your own white-labeled website on your own domain — every venue, your brand, the full
            booking flow. One hostname per site; requested and approved here.
          </p>
        </div>
        {req?.status === "live" && req.display_hostname && (
          <Button variant="ghost" size="sm" onClick={() => window.open(`https://${req.display_hostname}`, "_blank")}>
            Visit your site
          </Button>
        )}
      </div>

      {error && <p className="mt-4 rounded-xl bg-error-light px-3 py-2 text-sm text-error">{error}</p>}
      {notice && <p className="mt-4 rounded-xl bg-success-light px-3 py-2 text-sm text-success">{notice}</p>}

      {!req ? (
        <RequestForm suggested={query.data?.suggested_subdomain ?? ""} onError={onError} onDone={() => { invalidate(); setNotice("Site request submitted — our team will review it."); }} />
      ) : (
        <RequestStatus req={req} onError={onError} onDone={() => { invalidate(); setNotice("Updated."); }} />
      )}
    </Card>
  );
}

function RequestForm({ suggested, onError, onDone }: { suggested: string; onError: (e: unknown) => void; onDone: () => void }) {
  const [kind, setKind] = useState<"custom" | "subdomain">("custom");
  const [hostname, setHostname] = useState("");

  const submit = useMutation({
    mutationFn: () => business.createSiteRequest({ hostname_kind: kind, hostname }),
    onSuccess: onDone,
    onError: onError
  });

  return (
    <div className="mt-4 grid gap-3 rounded-2xl bg-surface-2 p-4 sm:grid-cols-[200px_minmax(0,1fr)_auto] sm:items-end">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-ink-2">Hostname kind</span>
        <SelectSheet value={kind} onChange={(e) => { setKind(e.target.value as "custom" | "subdomain"); setHostname(""); }} className="w-full">
          <option value="custom">My own domain</option>
          <option value="subdomain">myslot.lk subdomain</option>
        </SelectSheet>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-ink-2">
          {kind === "custom" ? "Your domain (e.g. abc.lk)" : "Suggested subdomain"}
        </span>
        <Input
          value={hostname}
          onChange={(e) => setHostname(e.target.value)}
          placeholder={kind === "custom" ? "abc.lk" : suggested || "your-name.myslot.lk"}
          className="w-full"
        />
        {kind === "subdomain" && suggested && (
          <span className="mt-1 block text-xs text-ink-3">
            Available: <code className="rounded bg-surface px-1">{suggested}</code>
          </span>
        )}
      </label>
      <Button loading={submit.isPending} disabled={!hostname.trim()} onClick={() => submit.mutate()}>
        Request site
      </Button>
    </div>
  );
}

function RequestStatus({ req, onError, onDone }: { req: SiteRequest; onError: (e: unknown) => void; onDone: () => void }) {
  const [editMode, setEditMode] = useState(false);
  const [kind, setKind] = useState<"custom" | "subdomain">(req.hostname_kind);
  const [hostname, setHostname] = useState(req.hostname_kind === "subdomain" ? req.hostname : req.hostname.replace(/^www\./, ""));

  const dnsAdded = useMutation({ mutationFn: () => business.siteDnsAdded(), onSuccess: onDone, onError });
  const resubmit = useMutation({
    mutationFn: () => business.createSiteRequest({ hostname_kind: kind, hostname }),
    onSuccess: () => { setEditMode(false); onDone(); },
    onError
  });

  const stepIndex = STEPS.indexOf(req.status);
  const rejected = req.status === "rejected";

  return (
    <div className="mt-4">
      {rejected ? (
        <div className="rounded-2xl bg-error-light px-4 py-3 text-sm text-error">
          <p className="font-semibold">Request not approved</p>
          {req.rejection_reason && <p className="mt-0.5">{req.rejection_reason}</p>}
        </div>
      ) : (
        <ol className="flex flex-wrap items-center gap-1.5">
          {STEPS.map((step, i) => {
            const done = i <= stepIndex;
            const active = i === stepIndex;
            return (
              <li key={step} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold",
                    done ? "bg-primary text-white" : "bg-surface-2 text-ink-3",
                    active && "ring-2 ring-primary/40"
                  )}
                >
                  {i + 1}
                </span>
                <span className={cn("text-xs font-medium", done ? "text-ink" : "text-ink-3")}>{STEP_LABELS[step]}</span>
                {i < STEPS.length - 1 && <span className={cn("h-px w-4", done ? "bg-primary" : "bg-border")} />}
              </li>
            );
          })}
        </ol>
      )}

      <p className="mt-3 font-mono text-sm font-semibold text-ink">
        {req.display_hostname ?? req.hostname}
        <Badge variant={rejected ? "error" : req.status === "live" ? "success" : "neutral"} className="ml-2">
          {rejected ? "Rejected" : STEP_LABELS[req.status] ?? req.status}
        </Badge>
      </p>

      {req.dns_name && req.dns_value && !rejected && (
        <div className="mt-3 rounded-2xl bg-surface-2 px-4 py-3 text-xs text-ink-2">
          <p className="font-semibold uppercase tracking-wider text-ink-3">DNS record to add</p>
          <p className="mt-1 font-mono">
            Type <span className="font-bold text-ink">{req.dns_type}</span> — Name{" "}
            <span className="font-bold text-ink">{req.dns_name}</span> — Value{" "}
            <span className="font-bold text-ink">{req.dns_value}</span>
          </p>
          {["approved", "dns_pending"].includes(req.status) && (
            <Button size="sm" className="mt-3" loading={dnsAdded.isPending} onClick={() => dnsAdded.mutate()}>
              I&apos;ve added the record
            </Button>
          )}
          {req.status === "verifying" && (
            <p className="mt-2 text-xs text-ink-3">DNS verified — our team is finishing the last steps.</p>
          )}
        </div>
      )}

      {rejected && (
        <div className="mt-4">
          {!editMode ? (
            <Button variant="secondary" size="sm" onClick={() => setEditMode(true)}>
              <RotateCcw className="h-4 w-4" /> Edit &amp; re-request
            </Button>
          ) : (
            <div className="grid gap-3 rounded-2xl bg-surface-2 p-4 sm:grid-cols-[200px_minmax(0,1fr)_auto] sm:items-end">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-ink-2">Hostname kind</span>
                <SelectSheet value={kind} onChange={(e) => setKind(e.target.value as "custom" | "subdomain")} className="w-full">
                  <option value="custom">My own domain</option>
                  <option value="subdomain">myslot.lk subdomain</option>
                </SelectSheet>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-ink-2">New hostname</span>
                <Input value={hostname} onChange={(e) => setHostname(e.target.value)} className="w-full" />
              </label>
              <Button size="sm" loading={resubmit.isPending} disabled={!hostname.trim()} onClick={() => resubmit.mutate()}>
                Submit again
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}