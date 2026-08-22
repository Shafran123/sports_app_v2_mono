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