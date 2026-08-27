// Resolve the effective branding for a transactional message (brand-
// consolidation tickets 02/04). Business-scoped messages (booking/event/site)
// carry the Business's own name, logo and colors; everything else falls back
// to the platform Brand Name. The SMSGo sender mask is NEVER derived from
// here — it stays environment-driven (SMSGO_MASK).
const DEFAULT_PRIMARY = '#16a34a';
const DEFAULT_ACCENT = '#2563eb';

// brand: the Business's `brand` JSONB (may be null/empty).
// platform: the platform Brand Name string (always present).
// Returns the email theming tokens: concrete colors (platform defaults when
// the Business set none), the logo URL, and the platform name for the email
// footer attribution.
function brandTokens(brand, platform) {
  const b = brand || null;
  return {
    logo_url: b?.logo_url || '',
    primary: b?.colors?.primary || DEFAULT_PRIMARY,
    accent: b?.colors?.accent || DEFAULT_ACCENT,
    platform: String(platform || '')
  };
}

module.exports = { brandTokens };
