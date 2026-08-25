"use client";

// Owner self-serve surface for the off-platform story (ADR-0028 v1.5, ticket
// 08): the Business profile (name + brand) and its Widget Instances (embed
// keys, default venues, venue-choice toggle, domain allowlists). Replaces the
// per-venue "Widget & page" tab — the widget is owned by the Business, not
// the venue.

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { business, featureFlags, toApiFailure } from "@myslot/api";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogContent,
  DialogTrigger,
  ErrorState,
  Input,
  SelectSheet,
  Skeleton,
  Textarea
} from "@myslot/ui";
import { Copy, Eye, Globe, Plus, Trash2, X } from "lucide-react";
import type { BusinessProfile, WidgetInstance, WidgetInstanceInput } from "@myslot/types";
import { SiteRequestSection } from "./site-request-section";

const blankForm = {
  name: "",
  defaultVenueId: "",
  allowVenueChoice: true,
  domainDraft: "",
  domains: [] as string[]
};

export function WidgetSitePage() {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["business-me"], queryFn: () => business.me(), staleTime: 30_000 });
  const instances = useQuery({
    queryKey: ["widget-instances"],
    queryFn: () => business.widgetInstances(),
    staleTime: 30_000
  });

  const { data: flags } = useQuery({ queryKey: ["public-flags"], queryFn: () => featureFlags.get() });
  const appOrigin = flags?.app_url || (typeof window !== "undefined" ? window.location.origin : "");

  const [editing, setEditing] = useState<WidgetInstance | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<WidgetInstance | null>(null);

  if (me.isLoading || instances.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }
  if (me.isError || !me.data) {
    return <ErrorState title="Could not load your business" onRetry={() => me.refetch()} />;
  }

  const profile = me.data;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["business-me"] });
    void queryClient.invalidateQueries({ queryKey: ["widget-instances"] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Widget &amp; site</h1>
        <p className="mt-1 text-sm text-ink-2">
          Your business brand and every embeddable booking widget. Create one instance per website,
          venue, or campaign — each has its own domain allowlist and default venue.
        </p>
      </div>

      <BusinessEditor profile={profile} appOrigin={appOrigin} onSaved={invalidate} />

      <SiteRequestSection />

      <Card className="p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight text-ink">
              <Globe className="h-5 w-5 text-ink-3" /> Widget instances
            </h2>
            <p className="mt-0.5 text-sm text-ink-2">
              Paste an instance&apos;s snippet on the website it belongs to. Anyone can read the embed
              key — only the domains you allow may load it.
            </p>
          </div>
          <Dialog open={creating} onOpenChange={setCreating}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4" /> New instance
              </Button>
            </DialogTrigger>
            <DialogContent title="New widget instance" description="One embeddable booking surface.">
              {creating && <InstanceForm profile={profile} onSaved={() => { setCreating(false); invalidate(); }} />}
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-4 space-y-3">
          {instances.isError || !instances.data ? (
            <ErrorState title="Could not load instances" onRetry={() => instances.refetch()} />
          ) : instances.data.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-surface-2 p-8 text-center text-sm text-ink-3">
              No widgets yet — create your first instance and embed it on your website.
            </div>
          ) : (
            instances.data.map((instance) => (
              <InstanceRow
                key={instance.id}
                instance={instance}
                profile={profile}
                appOrigin={appOrigin}
                onEdit={setEditing}
                onDelete={() => setDeleting(instance)}
                onSaved={invalidate}
              />
            ))
          )}
        </div>
      </Card>

      <EditDialog
        instance={editing}
        profile={profile}
        onClose={() => setEditing(null)}
        onSaved={invalidate}
      />

      <DeleteDialog instance={deleting} onClose={() => setDeleting(null)} onDeleted={invalidate} />
    </div>
  );
}

function BusinessEditor({ profile, appOrigin, onSaved }: { profile: BusinessProfile; appOrigin: string; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(profile.name);
  const [primary, setPrimary] = useState(profile.brand?.colors?.primary ?? "");
  const [accent, setAccent] = useState(profile.brand?.colors?.accent ?? "");
  const [logoUrl, setLogoUrl] = useState(profile.brand?.logo_url ?? "");
  const [tagline, setTagline] = useState(profile.brand?.tagline ?? "");
  const [about, setAbout] = useState(profile.brand?.about ?? "");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: () =>
      business.updateMe({
        name: name.trim() || undefined,
        brand: {
          colors: {
            primary: primary.trim() || undefined,
            accent: accent.trim() || undefined
          },
          logo_url: logoUrl.trim() || undefined,
          tagline: tagline.trim() || undefined,
          about: about.trim() || undefined
        }
      }),
    onSuccess: () => {
      setNotice("Business saved. This brand is used across every widget and page.");
      setError("");
      onSaved();
      void queryClient.invalidateQueries({ queryKey: ["business-me"] });
    },
    onError: (err) => {
      setError(toApiFailure(err).message);
      setNotice("");
    }
  });

  return (
    <Card className="p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">Your business brand</h2>
          <p className="mt-0.5 text-sm text-ink-2">
            The name and look shown in every widget and on every branded page. Your branded pages
            live at <code className="rounded bg-surface-2 px-1">/{profile.venues[0]?.slug ?? "your-venue"}</code>.
          </p>
        </div>
        {profile.venues[0]?.slug && appOrigin && (
          <Button variant="ghost" size="sm" onClick={() => window.open(`${appOrigin}/${profile.venues![0]!.slug}`, "_blank")}>
            <Eye className="h-4 w-4" /> Preview page
          </Button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Business name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Primary color</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(primary) ? primary : "#16a34a"}
              onChange={(e) => setPrimary(e.target.value)}
              aria-label="Primary color picker"
              className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-transparent"
            />
            <Input value={primary} onChange={(e) => setPrimary(e.target.value)} placeholder="#16a34a" className="flex-1" />
          </div>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Accent color</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : "#2563eb"}
              onChange={(e) => setAccent(e.target.value)}
              aria-label="Accent color picker"
              className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-transparent"
            />
            <Input value={accent} onChange={(e) => setAccent(e.target.value)} placeholder="#2563eb" className="flex-1" />
          </div>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Tagline</span>
          <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Book your court in seconds" />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Logo URL (https)</span>
          <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://theirsite.com/logo.png" />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-ink-2">About</span>
          <Textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={3} placeholder="Tell visitors what makes your venues special…" />
        </label>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-ink-3">Prices and availability always come straight from your court setup — no double entry.</p>
        <Button onClick={() => save.mutate()} loading={save.isPending}>
          {save.isPending ? "Saving…" : "Save brand"}
        </Button>
      </div>
      {notice && <p className="mt-3 rounded-xl bg-success-light px-3 py-2 text-sm text-success">{notice}</p>}
      {error && <p className="mt-3 rounded-xl bg-error-light px-3 py-2 text-sm text-error">{error}</p>}
    </Card>
  );
}

function InstanceRow({
  instance,
  profile,
  appOrigin,
  onEdit,
  onDelete,
  onSaved
}: {
  instance: WidgetInstance;
  profile: BusinessProfile;
  appOrigin: string;
  onEdit: (instance: WidgetInstance) => void;
  onDelete: () => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const embedSrc = appOrigin ? `${appOrigin}/embed/${instance.embed_key}` : null;

  const copySnippet = async () => {
    if (!embedSrc) return;
    const snippet = `<iframe src="${embedSrc}" width="100%" height="720" style="border:0;border-radius:16px" loading="lazy" title="Book with ${profile.name}"></iframe>`;
    if (typeof navigator !== "undefined") {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggle = useMutation({
    mutationFn: () => business.updateWidgetInstance(instance.id, { enabled: !instance.enabled }),
    onSuccess: onSaved
  });

  const locked = !instance.allow_venue_choice;

  return (
    <div className="rounded-3xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-ink">{instance.name}</p>
            <Badge variant={instance.enabled ? "success" : "neutral"}>
              {instance.enabled ? (locked ? "Live · locked to default" : "Live") : "Paused"}
            </Badge>
            {locked && <Badge variant="neutral">Default: {instance.default_venue_name ?? "—"}</Badge>}
          </div>
          <p className="mt-1 font-mono text-xs text-ink-3">/embed/{instance.embed_key}</p>
          {instance.allowed_domains.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {instance.allowed_domains.map((host) => (
                <li key={host} className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-ink-2">{host}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void copySnippet()}>
            <Copy className="h-4 w-4" /> {copied ? "Copied!" : "Copy embed"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onEdit(instance)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => void toggle.mutate()}>
            {instance.enabled ? "Pause" : "Go live"}
          </Button>
          <Button variant="ghost" size="sm" aria-label={`Delete ${instance.name}`} onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-error" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Shared create/edit form. Eligible venues: approved venues of the business.
function InstanceForm({
  profile,
  instance,
  onSaved
}: {
  profile: BusinessProfile;
  instance?: WidgetInstance | null;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const venues = profile.venues.filter((v) => v.status === "approved");
  const [name, setName] = useState(instance?.name ?? "");
  const [defaultVenueId, setDefaultVenueId] = useState(instance?.default_venue_id ?? "");
  const [allowVenueChoice, setAllowVenueChoice] = useState(instance?.allow_venue_choice ?? true);
  const [domains, setDomains] = useState<string[]>(instance?.allowed_domains ?? []);
  const [domainDraft, setDomainDraft] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const save = useMutation({
    mutationFn: () => {
      const input: WidgetInstanceInput = {
        name: name.trim(),
        default_venue_id: defaultVenueId || null,
        allow_venue_choice: allowVenueChoice,
        allowed_domains: domains
      };
      return instance
        ? business.updateWidgetInstance(instance.id, input)
        : business.createWidgetInstance({ ...input, name: name.trim() });
    },
    onSuccess: () => {
      setNotice(instance ? "Instance updated." : "Instance created — copy its snippet to go live.");
      void queryClient.invalidateQueries({ queryKey: ["widget-instances"] });
      onSaved();
    },
    onError: (err) => setError(toApiFailure(err).message)
  });

  const addDomain = () => {
    const host = domainDraft.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!host || domains.includes(host)) return;
    setDomains([...domains, host]);
    setDomainDraft("");
  };

  return (
    <div className="space-y-3">
      {notice && <p className="rounded-xl bg-success-light px-3 py-2 text-sm text-success">{notice}</p>}
      {error && <p className="rounded-xl bg-error-light px-3 py-2 text-sm text-error">{error}</p>}

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-ink-2">Name</span>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Main website" />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-ink-2">Default venue</span>
        {venues.length === 0 ? (
          <p className="rounded-xl bg-warning-light px-3 py-2 text-sm text-warning">
            No approved venues yet — approve at least one venue before creating a widget.
          </p>
        ) : (
          <SelectSheet
            value={defaultVenueId}
            onChange={(e) => setDefaultVenueId(e.target.value)}
            placeholder={venues.length > 0 ? "Choose venue…" : "No approved venues"}
          >
            <option value="">No default venue</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </SelectSheet>
        )}
      </label>

      <label className="flex items-start gap-3 rounded-2xl border border-border bg-surface-2 p-3">
        <Checkbox
          checked={allowVenueChoice}
          onChange={(e) => setAllowVenueChoice(e.target.checked)}
          className="mt-0.5"
        />
        <span className="text-sm text-ink-2">
          <span className="block font-semibold text-ink">Let customers choose the venue</span>
          <span className="mt-0.5 block">
            {allowVenueChoice
              ? "The widget opens on the default venue; visitors can switch. "
              : "The widget is locked to the default venue — no selector shown. "}
            When your business has one venue, no selector ever shows.
          </span>
        </span>
      </label>

      <div>
        <span className="mb-1.5 block text-xs font-medium text-ink-2">Allowed domains</span>
        <p className="mb-2 text-xs text-ink-3">
          The widget only renders on these websites. Exact hostnames only (subdomains are not implied).
        </p>
        <div className="flex max-w-md items-center gap-2">
          <Input
            value={domainDraft}
            onChange={(e) => setDomainDraft(e.target.value)}
            placeholder="theirsite.com"
            aria-label="Allowed domain"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addDomain();
              }
            }}
          />
          <Button type="button" variant="secondary" size="sm" onClick={addDomain}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        {domains.length === 0 ? (
          <p className="mt-2 text-xs text-ink-3">No domains yet — the widget stays hidden everywhere until you add one.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {domains.map((host) => (
              <li key={host} className="flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm text-ink">
                {host}
                <button type="button" aria-label={`Remove ${host}`} onClick={() => setDomains(domains.filter((d) => d !== host))} className="text-ink-3 transition-colors hover:text-error">
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-end pt-1">
        <Button onClick={() => save.mutate()} loading={save.isPending} disabled={venues.length === 0}>
          {save.isPending ? "Saving…" : instance ? "Save changes" : "Create instance"}
        </Button>
      </div>
    </div>
  );
}

function EditDialog({
  instance,
  profile,
  onClose,
  onSaved
}: {
  instance: WidgetInstance | null;
  profile: BusinessProfile;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open={!!instance} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Edit ${instance?.name ?? "instance"}`} description="Defaults, domains and venue choice for this embed.">
        {instance && <InstanceForm profile={profile} instance={instance} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  instance,
  onClose,
  onDeleted
}: {
  instance: WidgetInstance | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [error, setError] = useState("");
  const del = useMutation({
    mutationFn: () => business.deleteWidgetInstance(instance!.id),
    onSuccess: () => {
      onDeleted();
      onClose();
    },
    onError: (err) => setError(toApiFailure(err).message)
  });

  return (
    <Dialog open={!!instance} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title="Delete this widget?"
        description="Existing embeds will stop working immediately. Bookings already made are unaffected."
      >
        {instance && (
          <div className="space-y-3">
            {error && <p className="rounded-xl bg-error-light px-3 py-2 text-sm text-error">{error}</p>}
            <p className="text-sm text-ink-2">
              You are deleting <span className="font-semibold text-ink">{instance.name}</span> (
              <code className="rounded bg-surface-2 px-1">/embed/{instance.embed_key.slice(0, 8)}…</code>
              ). This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button variant="destructive" loading={del.isPending} onClick={() => del.mutate()}>
                Delete instance
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}