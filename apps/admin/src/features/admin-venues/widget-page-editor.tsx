"use client";

// Owner self-serve surface for the off-platform story (ADR-0028, ticket 08):
// the venue's Booking Widget (on/off, embed snippet, domain allowlist) and
// the white-labeled Branded Venue Page (brand tokens) in one place.

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { business, featureFlags, toApiFailure } from "@myslot/api";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ErrorState,
  Input,
  Skeleton,
  Textarea
} from "@myslot/ui";
import { Copy, ExternalLink, Eye, Globe, Plus, Trash2, X } from "lucide-react";
import type { WidgetSettings } from "@myslot/types";

interface Props {
  venueId: string;
  venueName: string;
  approved: boolean;
}

export function WidgetPageEditor({ venueId, venueName, approved }: Props) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["widget-settings", venueId],
    queryFn: () => business.widgetSettings(venueId),
    staleTime: 30_000
  });

  const [primary, setPrimary] = useState("");
  const [accent, setAccent] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [tagline, setTagline] = useState("");
  const [about, setAbout] = useState("");
  const [domainDraft, setDomainDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // The widget lives on the player app (FRONTEND_URL), not this console —
  // snippet/preview URLs must point there.
  const { data: flags } = useQuery({
    queryKey: ["public-flags"],
    queryFn: () => featureFlags.get()
  });
  const appOrigin = flags?.app_url || (typeof window !== "undefined" ? window.location.origin : "");

  const settings = query.data;

  useEffect(() => {
    if (!settings) return;
    setPrimary(settings.brand?.colors?.primary ?? "");
    setAccent(settings.brand?.colors?.accent ?? "");
    setLogoUrl(settings.brand?.logo_url ?? "");
    setTagline(settings.brand?.tagline ?? "");
    setAbout(settings.brand?.about ?? "");
  }, [settings]);

  const save = useMutation({
    mutationFn: (patch: Parameters<typeof business.updateWidgetSettings>[1]) =>
      business.updateWidgetSettings(venueId, patch),
    onSuccess: () => {
      setNotice("Settings saved.");
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["widget-settings", venueId] });
      void queryClient.invalidateQueries({ queryKey: ["my-venues"] });
    },
    onError: (err) => {
      setError(toApiFailure(err).message);
      setNotice("");
    }
  });

  const saveBranding = () => {
    setNotice("");
    save.mutate({
      brand: {
        colors: {
          primary: primary.trim() || undefined,
          accent: accent.trim() || undefined
        },
        logo_url: logoUrl.trim() || undefined,
        tagline: tagline.trim() || undefined,
        about: about.trim() || undefined
      }
    });
  };

  const addDomain = () => {
    setNotice("");
    const host = domainDraft.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!host) return;
    const current = settings?.allowed_domains ?? [];
    if (current.includes(host)) {
      setDomainDraft("");
      return;
    }
    save.mutate(
      { allowed_domains: [...current, host] },
      {
        onSuccess: () => setDomainDraft("")
      }
    );
  };

  const removeDomain = (host: string) => {
    setNotice("");
    save.mutate({ allowed_domains: (settings?.allowed_domains ?? []).filter((d) => d !== host) });
  };

  const embedSrc = useMemo(() => {
    const origin = flags?.app_url || (typeof window === "undefined" ? "" : window.location.origin);
    return origin ? `${origin}/embed/${settings?.widget_key ?? "•••"}` : null;
  }, [flags?.app_url, settings?.widget_key]);

  const pageUrl = useMemo(() => {
    if (!settings?.slug) return null;
    const origin = flags?.app_url || (typeof window === "undefined" ? "" : window.location.origin);
    return origin ? `${origin}/${settings.slug}` : null;
  }, [flags?.app_url, settings?.slug]);

  const copySnippet = async () => {
    if (!embedSrc) return;
    const snippet = `<iframe src="${embedSrc}" width="100%" height="720" style="border:0;border-radius:16px" loading="lazy" title="Book at ${venueName}"></iframe>`;
    if (typeof navigator !== "undefined") {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-40 w-full rounded-3xl" />
      </div>
    );
  }
  if (query.isError || !settings) {
    return <ErrorState title="Could not load widget settings" onRetry={() => query.refetch()} />;
  }

  return (
    <div className="space-y-4">
      {/* Widget on/off */}
      <Card className="p-5 md:p-6">
        <label className="flex items-start gap-3">
          <Checkbox
            checked={settings.widget_enabled}
            disabled={!approved}
            onChange={(e) => {
              setNotice("");
              save.mutate({ widget_enabled: e.target.checked });
            }}
            className="mt-0.5"
          />
          <span>
            <span className="block font-semibold text-ink">Booking widget on</span>
            <span className="mt-0.5 block text-sm text-ink-2">
              Publish this venue&apos;s booking flow on your own website. Turning this on also
              publishes your branded page at <code className="rounded bg-surface-2 px-1">{settings.slug ? `/${settings.slug}` : "your venue page"}</code>.
            </span>
            {!approved && (
              <span className="mt-2 block rounded-xl bg-warning-light px-3 py-2 text-sm text-warning">
                The widget goes live once your venue is approved.
              </span>
            )}
          </span>
        </label>
        {settings.visibility === "private" && (
          <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2">
            This venue is <Badge variant="neutral">private</Badge> — it never appears in the
            marketplace, so the widget and your page are its only booking surfaces.
          </p>
        )}
      </Card>

      {/* Embed snippet */}
      {settings.widget_enabled && (
        <Card className="p-5 md:p-6">
          <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">Embed on your website</h2>
          <p className="mt-0.5 text-sm text-ink-2">
            Paste this snippet wherever you want bookings to appear. Anyone can read the embed key —
            only the domains you allow below may actually load the widget.
          </p>
          {embedSrc && (
            <pre className="mt-4 overflow-x-auto rounded-xl bg-ink px-4 py-3 text-xs text-surface">
              <code>{`<iframe src="${embedSrc}" width="100%" height="720" style="border:0;border-radius:16px" loading="lazy" title="Book at ${venueName}"></iframe>`}</code>
            </pre>
          )}
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => void copySnippet()}>
            <Copy className="h-4 w-4" /> {copied ? "Copied!" : "Copy snippet"}
          </Button>
        </Card>
      )}

      {/* Domain allowlist */}
      <Card className="p-5 md:p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight text-ink">
          <Globe className="h-5 w-5 text-ink-3" /> Allowed domains
        </h2>
        <p className="mt-0.5 text-sm text-ink-2">
          The widget only renders on these websites. Add every domain you embed it on; exact
          hostnames only (subdomains are not implied).
        </p>

        <div className="mt-4 flex max-w-md items-center gap-2">
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

        {settings.allowed_domains.length === 0 ? (
          <p className="mt-3 text-sm text-ink-3">No domains yet — the widget stays hidden everywhere until you add one.</p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {settings.allowed_domains.map((host) => (
              <li key={host} className="flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm text-ink">
                {host}
                <button
                  type="button"
                  aria-label={`Remove ${host}`}
                  onClick={() => removeDomain(host)}
                  className="text-ink-3 transition-colors hover:text-error"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Brand editor */}
      <Card className="p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">Your page&apos;s look</h2>
            <p className="mt-0.5 text-sm text-ink-2">
              Colors, logo and copy for your branded page. Prices and availability always come
              straight from your court setup — no double entry.
            </p>
          </div>
          {settings.widget_enabled && pageUrl && (
            <Button variant="ghost" size="sm" onClick={() => window.open(pageUrl, "_blank")}>
              <Eye className="h-4 w-4" /> Preview page
            </Button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <span className="mb-1.5 block text-xs font-medium text-ink-2">About this venue</span>
            <Textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="Tell visitors what makes this venue special…"
              rows={4}
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={saveBranding} loading={save.isPending}>
            {save.isPending ? "Saving…" : "Save look"}
          </Button>
        </div>
      </Card>

      {settings.widget_enabled && pageUrl && (
        <p className="flex items-center gap-1 text-xs text-ink-3">
          <ExternalLink className="h-3.5 w-3.5" /> Your page lives at {pageUrl}
        </p>
      )}
      {notice && <p className="rounded-xl bg-success-light px-3 py-2 text-sm text-success">{notice}</p>}
      {error && <p className="rounded-xl bg-error-light px-3 py-2 text-sm text-error">{error}</p>}
    </div>
  );
}