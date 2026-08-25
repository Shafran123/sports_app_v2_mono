export function formatLkr(n: number | string | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "Rs \u2014";
  const value = Number(n);
  const formatted = value.toLocaleString("en-LK", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2
  });
  return `Rs ${formatted}`;
}

/**
 * Turn a stored slug/underscore value into display wording: "changing_rooms"
 * -> "Changing Rooms", "ac" -> "AC". Amenities and other enum-ish strings are
 * persisted as slugs; never show those raw to users.
 */
/**
 * Turn a stored slug/underscore value into display wording: "changing_rooms"
 * -> "Changing Rooms", "ac" -> "AC". Amenities and other enum-ish strings are
 * persisted as slugs; never show those raw to users.
 */
export function humanizeSlug(slug: string): string {
  const words = slug
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return slug;
  return words
    .map((w) => (w.toLowerCase() === "ac" ? "AC" : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Render a duration in minutes for humans: 45 -> "45m", 90 -> "1h 30m", 120 -> "2h". */
export function formatDuration(min: number | null | undefined): string {
  if (min === null || min === undefined || !Number.isFinite(min) || min <= 0) return "";
  const total = Math.round(min);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}