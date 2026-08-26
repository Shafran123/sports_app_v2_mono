const crypto = require('node:crypto');

// Off-platform venue presence helpers (ADR-0028): slugs for the branded page,
// embed keys for the widget, brand-token validation, and the domain
// allowlist matching used by the embed route.

const MAX_SLUG_LENGTH = 60;
const MAX_BRAND_LENGTH = 500;
const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const SLUG_SAFE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Site-brand contact block (ADR-0031): free-text fields, length-capped, all
// optional. Unknown keys are dropped like every brand token.
const CONTACT_CAPS = { phone: 30, email: 120, address: 200, hours: 200 };

// "Colombo Air Force Badminton Court" -> "colombo-air-force-badminton-court"
// Falls back to a short random stem when the name has no usable characters.
function slugify(name) {
  const slug = String(name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH);
  return slug || `venue-${crypto.randomBytes(3).toString('hex')}`;
}

// A stable embed key is public (it only identifies the widget instance);
// uniqueness is what matters, never secrecy. 32 hex chars is plenty for a
// namespace of thousands of instances without collisions.
function mintWidgetKey() {
  return crypto.randomBytes(16).toString('hex');
}

// Bearer of a branded page: public contact is the venue's own name/phone as
// the owner entered them — never the owner account's id or email.
function publicVenueBrand(venue) {
  return {
    ...venue,
    owner_id: undefined,
    ownerId: undefined
  };
}

function validateBrandToken(kind, value) {
  if (value === null || value === undefined) return undefined;
  if (kind === 'color') {
    if (typeof value !== 'string' || !HEX_COLOR.test(value.trim())) {
      throw Object.assign(new Error('Brand colors must be hex values like #16a34a'), { code: 'WIDGET_VALIDATION' });
    }
    return value.trim();
  }
  if (kind === 'short') {
    if (typeof value !== 'string' || value.trim().length > 80) {
      throw Object.assign(new Error('Tagline must be 80 characters or fewer'), { code: 'WIDGET_VALIDATION' });
    }
    return value.trim();
  }
  if (kind === 'long') {
    if (typeof value !== 'string' || value.trim().length > MAX_BRAND_LENGTH) {
      throw Object.assign(new Error(`Field must be ${MAX_BRAND_LENGTH} characters or fewer`), { code: 'WIDGET_VALIDATION' });
    }
    return value.trim();
  }
  if (kind === 'url') {
    if (typeof value !== 'string' || (value.length > 0 && !/^https:\/\/.+/.test(value.trim()))) {
      throw Object.assign(new Error('Must be an https URL or empty'), { code: 'WIDGET_VALIDATION' });
    }
    return value.trim();
  }
  return undefined;
}

// The site-brand contact block: an object of optional, length-capped free-text
// fields (phone, email, address, hours). Anything else is dropped.
function sanitizeContact(contact) {
  if (contact === undefined) return undefined;
  if (typeof contact !== 'object' || Array.isArray(contact)) {
    throw Object.assign(new Error('brand.contact must be an object'), { code: 'WIDGET_VALIDATION' });
  }
  const out = {};
  for (const key of Object.keys(CONTACT_CAPS)) {
    const value = contact[key];
    if (value === undefined) continue;
    if (typeof value !== 'string' || value.trim().length > CONTACT_CAPS[key]) {
      throw Object.assign(new Error(`brand.contact.${key} must be a string of ${CONTACT_CAPS[key]} characters or fewer`), { code: 'WIDGET_VALIDATION' });
    }
    out[key] = value.trim();
  }
  return out;
}

// Validate the owner's brand object; returns a clean copy (unknown keys
// dropped) or null when nothing brand-related was supplied.
function sanitizeBrand(brand) {
  if (brand === null || brand === undefined) return null;
  if (typeof brand !== 'object' || Array.isArray(brand)) {
    throw Object.assign(new Error('brand must be an object'), { code: 'WIDGET_VALIDATION' });
  }
  const out = {};
  if (brand.colors !== undefined) {
    if (typeof brand.colors !== 'object' || Array.isArray(brand.colors)) {
      throw Object.assign(new Error('brand.colors must be an object'), { code: 'WIDGET_VALIDATION' });
    }
    out.colors = {};
    if (brand.colors.primary !== undefined) out.colors.primary = validateBrandToken('color', brand.colors.primary);
    if (brand.colors.accent !== undefined) out.colors.accent = validateBrandToken('color', brand.colors.accent);
  }
  if (brand.logo_url !== undefined) out.logo_url = validateBrandToken('url', brand.logo_url);
  if (brand.tagline !== undefined) out.tagline = validateBrandToken('short', brand.tagline);
  if (brand.about !== undefined) out.about = validateBrandToken('long', brand.about);
  // Site-brand tokens (ADR-0031): hero image + headline for the portfolio
  // root, plus the contact block. Same rules as the shared tokens.
  if (brand.hero_image !== undefined) out.hero_image = validateBrandToken('url', brand.hero_image);
  if (brand.headline !== undefined) out.headline = validateBrandToken('short', brand.headline);
  if (brand.contact !== undefined) out.contact = sanitizeContact(brand.contact);
  return out;
}

// host[:port]. A port is optional and, when present, must match exactly — so
// a local dev host like `localhost:5173` is a distinct, precise entry.
const HOST_OR_HOSTPORT = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:\d{1,5})?$/;

function sanitizeDomains(domains) {
  if (domains === null || domains === undefined) return null;
  if (!Array.isArray(domains)) {
    throw Object.assign(new Error('allowed_domains must be an array of hostnames'), { code: 'WIDGET_VALIDATION' });
  }
  if (domains.length > 10) {
    throw Object.assign(new Error('At most 10 domains are allowed'), { code: 'WIDGET_VALIDATION' });
  }
  const out = [];
  for (const raw of domains) {
    const host = String(raw || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!host || host.length > 253 || !HOST_OR_HOSTPORT.test(host)) {
      throw Object.assign(new Error(`Invalid domain: ${raw}`), { code: 'WIDGET_VALIDATION' });
    }
    out.push(host);
  }
  return [...new Set(out)];
}

// An embed request is authorized when its parent origin (how the business's
// actual website frames the widget) matches an allowlist entry. An entry
// without a port matches the hostname on any port; an entry WITH a port (e.g.
// `localhost:5173`) must match both, so local testing is precise.
function isHostAllowed(holder, origin) {
  if (!holder || !Array.isArray(holder.allowed_domains) || holder.allowed_domains.length === 0) return false;
  let url;
  try {
    url = new URL(String(origin || '').includes('://') ? origin : `https://${origin}`);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  const port = url.port || null;
  for (const entry of holder.allowed_domains) {
    const [entryHost, entryPort = null] = String(entry).split(':');
    if (entryHost !== host) continue;
    if (entryPort === null || entryPort === port) return true;
  }
  return false;
}

module.exports = { slugify, mintWidgetKey, sanitizeBrand, sanitizeDomains, isHostAllowed, SLUG_SAFE };