const U = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=80`;

export const SPORT_IMAGES: Record<string, string> = {
  badminton: U("1626224583764-f87db24ac4ea"),
  football: U("1551958219-acbc608c6377"),
  futsal: U("1599058917212-d750089bc07e"),
  cricket: U("1531415074968-036ba1b575da"),
  tennis: U("1595435934249-5df7ed86e1c0"),
  padel: U("1622279457486-62dcc4a431d6"),
  pickleball: U("1595435934249-5df7ed86e1c0"),
  "table-tennis": U("1622279457486-62dcc4a431d6"),
  basketball: U("1517963879433-6ad2b056d712"),
  volleyball: U("1612872087720-bb876e2e67d1"),
  swimming: U("1519315901367-f34ff9154487"),
  golf: U("1571902943202-507ec2618e8f"),
  squash: U("1541534741688-6078c6bfb5c5"),
  "gym-fitness": U("1534438327276-14e5300c3a48"),
  "martial-arts": U("1517836357463-d25dfeac3438"),
  yoga: U("1544367567-0f2fcb009e0b"),
  running: U("1517248135467-4c7edcad34c4"),
  cycling: U("1552674605-db6ffd4facb5")
};

export const SPORT_GLYPH: Record<string, string> = {
  badminton: "🏸",
  football: "⚽",
  futsal: "🥅",
  cricket: "🏏",
  tennis: "🎾",
  padel: "🎾",
  pickleball: "🏓",
  "table-tennis": "🏓",
  basketball: "🏀",
  volleyball: "🏐",
  swimming: "🏊",
  golf: "⛳",
  squash: "🎾",
  "gym-fitness": "🏋️",
  "martial-arts": "🥋",
  yoga: "🧘",
  running: "🏃",
  cycling: "🚴"
};

export const FALLBACK_GLYPH = "🎯";

export function sportImage(slug?: string | null): string | null {
  if (!slug) return null;
  return SPORT_IMAGES[slug] ?? null;
}

export function sportGlyph(slug?: string | null): string {
  if (!slug) return FALLBACK_GLYPH;
  return SPORT_GLYPH[slug] ?? FALLBACK_GLYPH;
}

/** First sport slug from a venue's sports array (strings or {slug} objects). */
export function firstSportSlug(sports: unknown[] | undefined): string | null {
  if (!Array.isArray(sports) || sports.length === 0) return null;
  const first = sports[0];
  if (typeof first === "string") return first;
  if (first && typeof first === "object") {
    const o = first as { slug?: string; name?: string };
    return o.slug ?? o.name ?? null;
  }
  return null;
}

/** Resolve a venue's visual: first photo if present, else the sport imagery map. */
export function venueVisualSrc(
  venue: { photos?: unknown; sports?: unknown[] } | null | undefined,
  w = 800,
  h = 500
): string | null {
  if (!venue) return null;
  const photos = Array.isArray(venue.photos) ? (venue.photos as string[]).filter(Boolean) : [];
  if (photos.length) {
    const src = photos[0]!;
    return src.startsWith("http") ? `${src}?auto=format&fit=crop&w=${w}&h=${h}&q=80` : src;
  }
  const img = sportImage(firstSportSlug(venue.sports));
  return img ? `${img}&w=${w}&h=${h}` : null;
}

/** Resolve an event's visual: photos first, else sport imagery. */
export function eventVisualSrc(
  event: { photos?: unknown; sport?: string | null; sport_slug?: string | null } | null | undefined,
  w = 800,
  h = 500
): string | null {
  if (!event) return null;
  const photos = Array.isArray(event.photos) ? (event.photos as string[]).filter(Boolean) : [];
  if (photos.length) return `${photos[0]}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;
  const img = sportImage(event.sport_slug ?? event.sport);
  return img ? `${img}&w=${w}&h=${h}` : null;
}