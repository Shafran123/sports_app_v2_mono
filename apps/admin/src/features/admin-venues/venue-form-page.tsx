"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Plus, X } from "lucide-react";
import { sports } from "@spots/api";
import { toApiFailure } from "@spots/api";
import { Button, Card, Checkbox, Input, Select, Skeleton, Textarea } from "@spots/ui";
import { cn } from "@spots/utils";
import type { VenueHours } from "@spots/types";
import { submitCreateVenue, type CourtInput } from "./venue-api";
import { PhotoUploader } from "./photo-uploader";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];

const AMENITIES = [
  { value: "parking", label: "Parking" },
  { value: "changing_rooms", label: "Changing rooms" },
  { value: "showers", label: "Showers" },
  { value: "lighting", label: "Lighting" },
  { value: "ac", label: "AC" },
  { value: "equipment_rental", label: "Equipment rental" },
  { value: "water", label: "Water" }
];

interface CourtDraft {
  name: string;
  sport: string;
  price_per_slot: string;
  slot_duration_min: string;
  capacity: string;
  is_indoor: boolean;
}

const blankCourt = (): CourtDraft => ({
  name: "",
  sport: "",
  price_per_slot: "",
  slot_duration_min: "60",
  capacity: "",
  is_indoor: false
});

const blankHours = (): VenueHours[] =>
  DAYS.map((_, i) => ({ day_of_week: i, open_time: "06:00", close_time: "23:00" }));

export function NewVenuePage() {
  const router = useRouter();
  const [details, setDetails] = useState({ name: "", description: "", address: "", city: "", phone: "" });
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [courtRows, setCourtRows] = useState<CourtDraft[]>([blankCourt()]);
  const [hours, setHours] = useState<VenueHours[]>(blankHours());
  const [amenities, setAmenities] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [acceptsCash, setAcceptsCash] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const sportsQuery = useQuery({
    queryKey: ["sports"],
    queryFn: () => sports.list()
  });
  const allSports = sportsQuery.data ?? [];

  const courtSports = selectedSports.length
    ? allSports.filter((s) => selectedSports.includes(s.slug))
    : allSports;

  const toggleSport = (slug: string) => {
    setSelectedSports((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const toggleAmenity = (value: string) => {
    setAmenities((prev) =>
      prev.includes(value) ? prev.filter((a) => a !== value) : [...prev, value]
    );
  };

  const updateCourt = (index: number, patch: Partial<CourtDraft>) => {
    setCourtRows((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const removeCourt = (index: number) =>
    setCourtRows((prev) => prev.filter((_, i) => i !== index));

  const updateHour = (day: number, field: "open_time" | "close_time", value: string) => {
    setHours((prev) => prev.map((h) => (h.day_of_week === day ? { ...h, [field]: value } : h)));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!details.name.trim() || !details.address.trim() || !details.city.trim()) {
      setError("Name, address and city are required.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (selectedSports.length === 0) {
      setError("Select at least one sport.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (courtRows.length === 0) {
      setError("Add at least one court.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    for (const court of courtRows) {
      if (!court.name.trim()) {
        setError("Every court needs a name.");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (!court.price_per_slot || Number(court.price_per_slot) <= 0) {
        setError(`Every court needs a valid price per slot (${court.name.trim() || "unnamed court"}).`);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }
    for (const hour of hours) {
      if (Boolean(hour.open_time) !== Boolean(hour.close_time)) {
        setError(
          `Set both open and close time for ${DAYS[hour.day_of_week] ?? "this day"}, or leave both blank to mark it closed.`
        );
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }

    const payloadCourts: CourtInput[] = courtRows.map((court) => ({
      name: court.name.trim(),
      sport: court.sport || selectedSports[0] || "",
      price_per_slot: Number(court.price_per_slot),
      slot_duration_min: Number(court.slot_duration_min) || 60,
      capacity: court.capacity ? Number(court.capacity) : undefined,
      is_indoor: court.is_indoor
    }));

    setSubmitting(true);
    try {
      await submitCreateVenue({
        name: details.name.trim(),
        description: details.description.trim() || undefined,
        address: details.address.trim(),
        city: details.city.trim(),
        phone: details.phone.trim() || undefined,
        photos,
        amenities,
        accepts_cash: acceptsCash,
        sports: selectedSports,
        courts: payloadCourts,
        hours: hours
          .filter((h) => h.open_time && h.close_time)
          .map((h) => ({ day_of_week: h.day_of_week, open_time: h.open_time, close_time: h.close_time }))
      });
      setSubmitted(true);
    } catch (err) {
      setError(toApiFailure(err).message);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-col items-center rounded-3xl border border-border bg-surface px-6 py-14 text-center shadow-soft animate-fade-up">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-light text-success">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="mt-5 font-display text-2xl font-extrabold tracking-tight text-ink">
            Submitted for review!
          </h1>
          <p className="mt-2 max-w-sm text-sm text-ink-2">
            Our team will review your venue and let you know once it goes live.
          </p>
          <Button onClick={() => router.push("/venues")} className="mt-6">
            Back to My Venues
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">
            Add a venue
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            Tell us about your venue — it will be reviewed before going live.
          </p>
        </div>
        <Link
          href="/venues"
          className="hidden text-sm font-medium text-ink-2 transition-colors hover:text-ink sm:block"
        >
          Cancel
        </Link>
      </div>

      {error && (
        <div
          className="rounded-2xl border border-error bg-error-light px-4 py-3 text-sm font-medium text-error"
          role="alert"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-5 md:p-6">
          <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">
            Business details
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-2">
                Venue name <span className="text-error">*</span>
              </span>
              <Input
                value={details.name}
                onChange={(e) => setDetails({ ...details, name: e.target.value })}
                placeholder="Colombo Sports Club"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-2">Phone</span>
              <Input
                type="tel"
                value={details.phone}
                onChange={(e) => setDetails({ ...details, phone: e.target.value })}
                placeholder="+94 11 234 5678"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-xs font-medium text-ink-2">Description</span>
              <Textarea
                rows={3}
                value={details.description}
                onChange={(e) => setDetails({ ...details, description: e.target.value })}
                placeholder="Describe your venue, facilities and what makes it great."
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-2">
                Address <span className="text-error">*</span>
              </span>
              <Input
                value={details.address}
                onChange={(e) => setDetails({ ...details, address: e.target.value })}
                placeholder="12 Galle Road"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-2">
                City <span className="text-error">*</span>
              </span>
              <Input
                value={details.city}
                onChange={(e) => setDetails({ ...details, city: e.target.value })}
                placeholder="Colombo"
              />
            </label>
          </div>
        </Card>

        <Card className="p-5 md:p-6">
          <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">
            Sports <span className="text-error">*</span>
          </h2>
          <p className="mt-0.5 text-xs text-ink-3">
            Select at least one sport offered at your venue.
          </p>
          {sportsQuery.isLoading ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-9 w-24 rounded-full" />
              ))}
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {allSports.map((s) => {
                const selected = selectedSports.includes(s.slug);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSport(s.slug)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                      selected
                        ? "border-primary bg-primary text-white shadow-soft"
                        : "border-border bg-surface text-ink-2 hover:border-primary/40 hover:text-ink"
                    )}
                  >
                    {s.icon && <span aria-hidden="true">{s.icon}</span>}
                    {s.name}
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">
                Courts <span className="text-error">*</span>
              </h2>
              <p className="mt-0.5 text-xs text-ink-3">Add every court players can book.</p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => setCourtRows((prev) => [...prev, blankCourt()])}>
              <Plus className="h-4 w-4" /> Add court
            </Button>
          </div>
          <div className="mt-4 space-y-4">
            {courtRows.map((court, index) => (
              <div key={index} className="rounded-2xl border border-border bg-surface-2/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-semibold text-primary">
                    Court {index + 1}
                  </span>
                  {courtRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCourt(index)}
                      className="text-sm font-medium text-error transition-colors hover:text-error/80"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-ink-2">
                      Court name <span className="text-error">*</span>
                    </span>
                    <Input
                      value={court.name}
                      onChange={(e) => updateCourt(index, { name: e.target.value })}
                      placeholder="Court 1"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-ink-2">Sport</span>
                    <Select
                      value={court.sport}
                      onChange={(e) => updateCourt(index, { sport: e.target.value })}
                    >
                      {courtSports.length === 0 ? (
                        <option value="">Select a sport</option>
                      ) : (
                        courtSports.map((s) => (
                          <option key={s.id} value={s.slug}>
                            {s.name}
                          </option>
                        ))
                      )}
                    </Select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-ink-2">
                      Price per slot (Rs) <span className="text-error">*</span>
                    </span>
                    <Input
                      type="number"
                      min="0"
                      value={court.price_per_slot}
                      onChange={(e) => updateCourt(index, { price_per_slot: e.target.value })}
                      placeholder="1500"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-ink-2">Slot duration (minutes)</span>
                    <Input
                      type="number"
                      min="15"
                      step="15"
                      value={court.slot_duration_min}
                      onChange={(e) => updateCourt(index, { slot_duration_min: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-ink-2">Capacity</span>
                    <Input
                      type="number"
                      min="1"
                      value={court.capacity}
                      onChange={(e) => updateCourt(index, { capacity: e.target.value })}
                      placeholder="4"
                    />
                  </label>
                  <label className="flex items-center gap-2 self-end pb-3 text-sm font-medium text-ink-2">
                    <Checkbox
                      checked={court.is_indoor}
                      onChange={(e) => updateCourt(index, { is_indoor: e.target.checked })}
                    />
                    Indoor court
                  </label>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 md:p-6">
          <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">Opening hours</h2>
          <p className="mt-0.5 text-xs text-ink-3">Leave a day blank to mark it closed.</p>
          <div className="mt-4 space-y-2">
            {hours.map((hour) => (
              <div
                key={hour.day_of_week}
                className="grid grid-cols-2 items-center gap-2 rounded-2xl bg-surface-2/60 px-3 py-2.5 sm:grid-cols-[9rem_1fr_1fr] sm:gap-3"
              >
                <span className="col-span-2 text-sm font-medium text-ink sm:col-span-1">
                  {DAYS[hour.day_of_week]}
                </span>
                <Input
                  type="time"
                  aria-label={`${DAYS[hour.day_of_week] ?? "Day"} open time`}
                  value={hour.open_time}
                  onChange={(e) => updateHour(hour.day_of_week, "open_time", e.target.value)}
                />
                <Input
                  type="time"
                  aria-label={`${DAYS[hour.day_of_week] ?? "Day"} close time`}
                  value={hour.close_time}
                  onChange={(e) => updateHour(hour.day_of_week, "close_time", e.target.value)}
                />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 md:p-6">
          <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">Amenities</h2>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-3">
            {AMENITIES.map((a) => (
              <label key={a.value} className="flex items-center gap-2 text-sm font-medium text-ink-2">
                <Checkbox
                  checked={amenities.includes(a.value)}
                  onChange={() => toggleAmenity(a.value)}
                />
                {a.label}
              </label>
            ))}
          </div>
        </Card>

        <Card className="p-5 md:p-6">
          <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">Photos</h2>
          <p className="mt-0.5 text-xs text-ink-3">
            Add photos of your venue so players know what to expect.
          </p>
          <div className="mt-4">
            <PhotoUploader photos={photos} onChange={setPhotos} />
          </div>
        </Card>

        <Card className="p-5 md:p-6">
          <label className="flex items-start gap-3">
            <Checkbox
              checked={acceptsCash}
              onChange={(e) => setAcceptsCash(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="block font-semibold text-ink">Accept pay-at-venue (cash)</span>
              <span className="mt-0.5 block text-sm text-ink-2">
                Let players book now and pay in cash when they arrive. You record the payment from
                your console.
              </span>
            </span>
          </label>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="secondary" onClick={() => router.push("/venues")}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {submitting ? "Submitting…" : "Submit venue for review"}
          </Button>
        </div>
      </form>
    </div>
  );
}