"use client";

// Owner self-serve surface for the off-platform story (ADR-0028 v1.5, ticket
// 08): the Business profile (name + brand) and its Widget Instances (embed
// keys, default venues, venue-choice toggle, domain allowlists). Replaces the
// per-venue "Widget & page" tab — the widget is owned by the Business, not
// the venue.

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { business, featureFlags, toApiFailure, uploads } from "@myslot/api";
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
import { Copy, Globe, Plus, Trash2, X } from "lucide-react";
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

      <BusinessBrandCard profile={profile} onSaved={invalidate} />

      <SiteRequestSection profile={profile} />

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

function SingleImageField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const pick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const dataUrl = await readAsDataUrl(file);
      const base64 = dataUrl.split(",")[1];
      if (!base64) throw new Error("Could not read file as image");
      const { url } = await uploads.upload({ filename: file.name, data: base64 });
      onChange(url);
    } catch (err) {
      setError(toApiFailure(err).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="sm:col-span-2">
      <span className="mb-1.5 block text-xs font-medium text-ink-2">{label}</span>
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()} loading={uploading}>
          {uploading ? "Uploading…" : "Upload image"}
        </Button>
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://cdn.example.com/image.jpg" aria-label={label} className="flex-1" />
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files);
          e.target.value = "";
        }}
      />
      {value ? (
        <div className="mt-2 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-16 w-28 rounded-xl border border-border object-cover" />
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>Remove</Button>
        </div>
      ) : null}
      <p className="mt-2 text-xs text-ink-3">PNG, JPG or WebP · max 8MB</p>
      {error && <p className="mt-2 text-sm text-error">{error}</p>}
    </div>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

// The single Business Brand editor (brand-consolidation ticket 03): every
// brand field in one card, one save, one `brand` object (ADR-0031). Sections
// are labelled so an owner never enters the same thing twice — tagline (short)
// vs about (long), and a logo (mark) vs a site banner (wide hero image).
function BusinessBrandCard({ profile, onSaved }: { profile: BusinessProfile; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(profile.name);
  const [primary, setPrimary] = useState(profile.brand?.colors?.primary ?? "");
  const [accent, setAccent] = useState(profile.brand?.colors?.accent ?? "");
  const [logoUrl, setLogoUrl] = useState(profile.brand?.logo_url ?? "");
  const [tagline, setTagline] = useState(profile.brand?.tagline ?? "");
  const [about, setAbout] = useState(profile.brand?.about ?? "");
  const [bannerImage, setBannerImage] = useState(profile.brand?.banner_image ?? "");
  const [phone, setPhone] = useState(profile.brand?.contact?.phone ?? "");
  const [email, setEmail] = useState(profile.brand?.contact?.email ?? "");
  const [address, setAddress] = useState(profile.brand?.contact?.address ?? "");
  const [hours, setHours] = useState(profile.brand?.contact?.hours ?? "");
  const [facebook, setFacebook] = useState(profile.brand?.social_links?.facebook ?? "");
  const [instagram, setInstagram] = useState(profile.brand?.social_links?.instagram ?? "");
  const [tiktok, setTiktok] = useState(profile.brand?.social_links?.tiktok ?? "");
  const [whatsapp, setWhatsapp] = useState(profile.brand?.social_links?.whatsapp ?? "");
  const [youtube, setYoutube] = useState(profile.brand?.social_links?.youtube ?? "");
  const [privacy, setPrivacy] = useState(profile.brand?.privacy_policy ?? "");
  const [terms, setTerms] = useState(profile.brand?.terms_conditions ?? "");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: () =>
      business.updateMe({
        name: name.trim() || undefined,
        brand: {
          ...profile.brand,
          colors: {
            primary: primary.trim() || undefined,
            accent: accent.trim() || undefined
          },
          // Text/URL tokens send '' when cleared so the merge in updateProfile
          // persists the removal (an undefined key would leave the old value).
          logo_url: logoUrl.trim(),
          tagline: tagline.trim(),
          about: about.trim(),
          banner_image: bannerImage.trim(),
          contact: {
            phone: phone.trim(),
            email: email.trim(),
            address: address.trim(),
            hours: hours.trim()
          },
          social_links: {
            facebook: facebook.trim(),
            instagram: instagram.trim(),
            tiktok: tiktok.trim(),
            whatsapp: whatsapp.trim(),
            youtube: youtube.trim()
          },
          privacy_policy: privacy.trim(),
          terms_conditions: terms.trim()
        }
      }),
    onSuccess: () => {
      setNotice("Brand saved. This name and look is used everywhere.");
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
      <div>
        <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">Business brand</h2>
        <p className="mt-0.5 text-sm text-ink-2">
          One place for your name, look, and every surface — widgets, your dedicated site, and the
          emails and SMS we send on your behalf.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <h3 className="sm:col-span-2 mt-3 font-semibold text-ink">Identity</h3>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Business name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Tagline</span>
          <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Book your court in seconds" />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-ink-2">About</span>
          <Textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={3} placeholder="Tell visitors what makes your venues special…" />
        </label>

        <h3 className="sm:col-span-2 mt-3 font-semibold text-ink">Colors</h3>
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

        <h3 className="sm:col-span-2 mt-3 font-semibold text-ink">Images</h3>
        <SingleImageField label="Logo" value={logoUrl} onChange={setLogoUrl} />
        <SingleImageField label="Site banner" value={bannerImage} onChange={setBannerImage} />

        <h3 className="sm:col-span-2 mt-3 font-semibold text-ink">Contact</h3>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Contact phone</span>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+94 77 123 4567" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Contact email</span>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hello@yourvenue.lk" />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Contact address</span>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="12 Galle Rd, Colombo 03" />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Opening hours</span>
          <Input value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Mon–Sun 6am–11pm" />
        </label>

        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Social links</span>
          <p className="mb-2 text-xs text-ink-3">
            Shown as icons on your dedicated site. Leave a platform empty to hide it.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["Facebook", facebook, setFacebook],
                ["Instagram", instagram, setInstagram],
                ["TikTok", tiktok, setTiktok],
                ["WhatsApp", whatsapp, setWhatsapp],
                ["YouTube", youtube, setYoutube]
              ] as const
            ).map(([label, value, setter]) => (
              <label key={label} className="block">
                <span className="mb-1.5 block text-xs font-medium text-ink-2">{label}</span>
                <Input
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  placeholder="https://…"
                  aria-label={`${label} URL`}
                />
              </label>
            ))}
          </div>
        </div>

        <h3 className="sm:col-span-2 mt-3 font-semibold text-ink">Site policies</h3>
        <p className="sm:col-span-2 -mt-2 text-xs text-ink-3">
          Shown at the footer of your dedicated site. Until you write your own, short platform
          defaults with your business name are shown instead.
        </p>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Privacy policy</span>
          <Textarea
            value={privacy}
            onChange={(e) => setPrivacy(e.target.value)}
            rows={5}
            placeholder="Paste or write your privacy policy…"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Terms &amp; conditions</span>
          <Textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            rows={5}
            placeholder="Paste or write your terms…"
          />
        </label>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-ink-3">
          Prices and availability always come straight from your court setup — no double entry.
        </p>
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