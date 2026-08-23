"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { admin, toApiFailure } from "@myslot/api";
import { Button, Card, EmptyState, ErrorState, Input, SelectSheet, Textarea } from "@myslot/ui";
import { formatDateLong, formatLkr } from "@myslot/utils";
import type { OwnerAgreement, OwnerListItem, OwnerPlanTemplate } from "@myslot/types";

type AgreementDraft = { title: string; body: string };

export function OwnersPage() {
  const qc = useQueryClient();
  const [expiringWithin, setExpiringWithin] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [showCreate, setShowCreate] = React.useState(false);

  const ownersQuery = useQuery({
    queryKey: ["admin-owners", expiringWithin],
    queryFn: () => admin.listOwners(expiringWithin === "" ? undefined : Number(expiringWithin))
  });

  const templatesQuery = useQuery({
    queryKey: ["admin-plan-templates"],
    queryFn: () => admin.listPlanTemplates(false)
  });

  const owners = ownersQuery.data ?? [];
  const templates = templatesQuery.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">Owners</h1>
          <p className="mt-1 text-sm text-ink-2">
            Venue owner accounts, their plans and agreements. Renew expiring plans off-platform.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>Create owner</Button>
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-error">{error}</p>}

      <Card className="flex flex-col gap-2.5 p-4 sm:flex-row sm:items-end">
        <div className="w-full space-y-1.5 sm:w-56">
          <label htmlFor="owners-expiring" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
            Plan ends within
          </label>
          <SelectSheet id="owners-expiring" value={expiringWithin} onChange={(e) => setExpiringWithin(e.target.value)} className="w-full">
            <option value="">Any time</option>
            <option value="7">Next 7 days</option>
            <option value="14">Next 14 days</option>
            <option value="30">Next 30 days</option>
          </SelectSheet>
        </div>
      </Card>

      {ownersQuery.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="p-5"><div className="skeleton h-14 rounded-2xl" /></Card>
          ))}
        </div>
      ) : ownersQuery.isError ? (
        <ErrorState title="Could not load owners" message="The owner registry is unavailable right now." onRetry={() => ownersQuery.refetch()} />
      ) : owners.length === 0 ? (
        <EmptyState title="No owners match" message="Owners with a plan ending in this window appear here." />
      ) : (
        <div className="space-y-4">
          {owners.map((owner) => (
            <OwnerRow key={owner.id} owner={owner} templates={templates} onError={setError} onDone={() => qc.invalidateQueries({ queryKey: ["admin-owners"] })} />
          ))}
        </div>
      )}

      <PlanTemplatesSection templates={templates} onError={setError} onDone={() => qc.invalidateQueries({ queryKey: ["admin-plan-templates"] })} />

      {showCreate && (
        <CreateOwnerDialog
          templates={templates}
          onClose={() => setShowCreate(false)}
          onError={setError}
          onDone={() => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ["admin-owners"] });
          }}
        />
      )}
    </div>
  );
}

function OwnerRow({
  owner,
  templates,
  onError,
  onDone
}: {
  owner: OwnerListItem;
  templates: OwnerPlanTemplate[];
  onError: (e: string | null) => void;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [renewOpen, setRenewOpen] = React.useState(false);

  const nudge = useMutation({
    mutationFn: () => admin.nudgeOwner(owner.id),
    onSuccess: () => onError(null),
    onError: (e) => onError(toApiFailure(e)?.message ?? "Could not nudge the owner.")
  });

  const daysLeft = owner.plan_end
    ? Math.ceil((new Date(`${owner.plan_end}T23:59:59+05:30`).getTime() - Date.now()) / (24 * 3600 * 1000))
    : null;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{owner.name || owner.email}</p>
          <p className="mt-0.5 text-sm text-ink-2">{owner.email}{owner.venue_count ? ` • ${owner.venue_count} venue${owner.venue_count === 1 ? "" : "s"}` : ""}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
            {owner.plan_name ? (
              <>
                <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-ink-2">
                  {owner.plan_name} • {owner.plan_price_lkr ? formatLkr(owner.plan_price_lkr) : "Free"} • {owner.plan_start} → {owner.plan_end}
                </span>
                {daysLeft !== null && (
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${daysLeft <= 7 ? "bg-red-50 text-error" : "bg-amber-100 text-amber-700"}`}>
                    {daysLeft <= 0 ? "Ended" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
                  </span>
                )}
              </>
            ) : (
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-ink-3">No plan</span>
            )}
            {owner.agreement_status === "pending" && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Agreement pending</span>
            )}
            {owner.onboarding_state === "grandfathered" && (
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-ink-3">Grandfathered</span>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-3">Created {formatDateLong(owner.created_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setRenewOpen(true)} disabled={!owner.plan_name}>
            Renew
          </Button>
          <Button variant="secondary" size="sm" onClick={() => nudge.mutate()} disabled={nudge.isPending}>
            {nudge.isPending ? "Nudging…" : "Nudge"}
          </Button>
        </div>
      </div>

      {renewOpen && (
        <RenewDialog
          owner={owner}
          templates={templates}
          onClose={() => setRenewOpen(false)}
          onError={onError}
          onDone={() => {
            setRenewOpen(false);
            qc.invalidateQueries({ queryKey: ["admin-owners"] });
            onDone();
          }}
        />
      )}
    </Card>
  );
}

function RenewDialog({
  owner,
  templates,
  onClose,
  onError,
  onDone
}: {
  owner: OwnerListItem;
  templates: OwnerPlanTemplate[];
  onClose: () => void;
  onError: (e: string | null) => void;
  onDone: () => void;
}) {
  const [templateId, setTemplateId] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [agreement, setAgreement] = React.useState<AgreementDraft>({ title: `${owner.name ?? "Owner"} — Renewal Agreement`, body: "" });
  const [error, setError] = React.useState<string | null>(null);

  const renew = useMutation({
    mutationFn: () => admin.renewOwner(owner.id, { plan_template_id: templateId, start_date: startDate || undefined, agreement }),
    onSuccess: () => {
      onError(null);
      onDone();
    },
    onError: (e) => setError(toApiFailure(e)?.message ?? "Could not renew this owner.")
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-surface p-6 shadow-soft" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">Renew — {owner.name || owner.email}</h2>
        <p className="mt-1 text-sm text-ink-2">Drafts a new plan term and a fresh agreement for the owner to accept.</p>

        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-3">Plan template</label>
            <SelectSheet value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="w-full">
              <option value="">Select a plan…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.term_days} days{t.price_lkr ? ` • ${formatLkr(t.price_lkr)}` : " • Free"}
                </option>
              ))}
            </SelectSheet>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-3">Start date</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-3">Agreement title</label>
            <Input value={agreement.title} onChange={(e) => setAgreement((a) => ({ ...a, title: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-3">Agreement terms</label>
            <Textarea rows={6} value={agreement.body} onChange={(e) => setAgreement((a) => ({ ...a, body: e.target.value }))} placeholder="Terms of the renewed agreement…" />
          </div>
        </div>

        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-error">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => renew.mutate()} disabled={renew.isPending || !templateId || !agreement.body.trim()}>
            {renew.isPending ? "Renewing…" : "Draft & send"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CreateOwnerDialog({
  templates,
  onClose,
  onError,
  onDone
}: {
  templates: OwnerPlanTemplate[];
  onClose: () => void;
  onError: (e: string | null) => void;
  onDone: () => void;
}) {
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    phone: "",
    temporary_password: "",
    plan_template_id: "",
    start_date: "",
    agreement_title: "",
    agreement_body: ""
  });
  const [error, setError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<{ email: string; password: string } | null>(null);

  const create = useMutation({
    mutationFn: () =>
      admin.createOwner({
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        temporary_password: form.temporary_password,
        plan_template_id: form.plan_template_id || undefined,
        start_date: form.start_date || undefined,
        agreement: { title: form.agreement_title, body: form.agreement_body }
      }),
    onSuccess: (result) => {
      setCreated({ email: form.email, password: form.temporary_password });
      onError(null);
      onDone();
    },
    onError: (e) => setError(toApiFailure(e)?.message ?? "Could not create this owner.")
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  if (created) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm" onClick={onClose}>
        <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-soft" onClick={(e) => e.stopPropagation()}>
          <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">Owner created</h2>
          <p className="mt-1 text-sm text-ink-2">The credentials and agreement were emailed. Keep them handy for the handoff.</p>
          <div className="mt-4 rounded-2xl bg-surface-2 p-4 text-sm">
            <p><strong>Email:</strong> {created.email}</p>
            <p className="mt-1"><strong>Temporary password:</strong> <span className="font-mono">{created.password}</span></p>
          </div>
          <div className="mt-5 flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-surface p-6 shadow-soft" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">Create venue owner</h2>
        <p className="mt-1 text-sm text-ink-2">
          Creates a brand-new account (never reuses an existing player account), attaches a plan, drafts the agreement, and emails the credentials.
        </p>

        <div className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-3">Name</label>
              <Input value={form.name} onChange={set("name")} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-3">Phone</label>
              <Input value={form.phone} onChange={set("phone")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-3">Owner email (unique)</label>
            <Input type="email" value={form.email} onChange={set("email")} placeholder="owner@example.com — must not belong to another account" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-3">Temporary password</label>
            <Input value={form.temporary_password} onChange={set("temporary_password")} placeholder="Min 8 characters — emailed and forced to change on first login" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-3">Plan template</label>
              <SelectSheet value={form.plan_template_id} onChange={set("plan_template_id")} className="w-full">
                <option value="">Select a plan…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.term_days} days{t.price_lkr ? ` • ${formatLkr(t.price_lkr)}` : " • Free"}
                  </option>
                ))}
              </SelectSheet>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-3">Plan start date</label>
              <Input type="date" value={form.start_date} onChange={set("start_date")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-3">Agreement title</label>
            <Input value={form.agreement_title} onChange={set("agreement_title")} placeholder="e.g. MySlot.LK Venue Partner Agreement" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-3">Agreement terms</label>
            <Textarea rows={6} value={form.agreement_body} onChange={set("agreement_body")} placeholder="The sales agreement text sent with the credentials…" />
          </div>
        </div>

        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-error">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !form.email || !form.temporary_password || !form.plan_template_id || !form.agreement_body.trim()}
          >
            {create.isPending ? "Creating…" : "Create & email credentials"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PlanTemplatesSection({
  templates,
  onError,
  onDone
}: {
  templates: OwnerPlanTemplate[];
  onError: (e: string | null) => void;
  onDone: () => void;
}) {
  const [showCreate, setShowCreate] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const qc = useQueryClient();

  const archive = useMutation({
    mutationFn: (id: string) => admin.archivePlanTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-plan-templates"] });
      onError(null);
    },
    onError: (e) => onError(toApiFailure(e)?.message ?? "Could not archive the plan.")
  });

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-ink">Plan templates</h2>
          <p className="mt-0.5 text-sm text-ink-2">Term + price templates applied to owners. Zero price = free term. Archived templates stay in history but can't be applied.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowCreate(true)}>New template</Button>
      </div>

      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-error">{error}</p>}

      {templates.length === 0 ? (
        <p className="mt-4 text-sm text-ink-3">No plan templates yet — create one to attach to owners.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {templates.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="font-medium text-ink">{t.name}</p>
                <p className="text-sm text-ink-2">{t.term_days} days • {t.price_lkr ? formatLkr(t.price_lkr) : "Free"}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => archive.mutate(t.id)} disabled={archive.isPending}>
                Archive
              </Button>
            </li>
          ))}
        </ul>
      )}

      {showCreate && (
        <div className="mt-4 rounded-2xl border border-border p-4">
          <PlanTemplateForm
            onCancel={() => setShowCreate(false)}
            onDone={() => {
              setShowCreate(false);
              onDone();
            }}
          />
        </div>
      )}
    </Card>
  );
}

function PlanTemplateForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const [name, setName] = React.useState("");
  const [termDays, setTermDays] = React.useState("");
  const [priceLkr, setPriceLkr] = React.useState("0");
  const [error, setError] = React.useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => admin.createPlanTemplate({ name, term_days: Number(termDays), price_lkr: Number(priceLkr) }),
    onSuccess: onDone,
    onError: (e) => setError(toApiFailure(e)?.message ?? "Could not create the plan template.")
  });

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-3">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="6 months free" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-3">Term (days)</label>
          <Input type="number" min={1} value={termDays} onChange={(e) => setTermDays(e.target.value)} placeholder="180" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-3">Price (LKR, 0 = free)</label>
          <Input type="number" min={0} value={priceLkr} onChange={(e) => setPriceLkr(e.target.value)} />
        </div>
      </div>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-error">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending || !name.trim() || !Number(termDays)}>
          {create.isPending ? "Creating…" : "Create template"}
        </Button>
      </div>
    </div>
  );
}