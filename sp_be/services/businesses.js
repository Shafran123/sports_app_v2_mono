// Business model (ADR-0028 amendment v1.5): the owner's public brand and
// venue portfolio. One Business per Venue Owner in the MVP (schema allows
// more); it owns the brand tokens and the Widget Instances, and every Venue
// belongs to exactly one Business via venues.business_id.

const pool = require('../db');
const { sanitizeBrand } = require('../utils/widget');

// The approved venues a Business may sell through its widget surfaces:
// every approved venue of the business, Private Venues included
// (their widget is their only public surface); suspended / banned /
// archived venues are excluded by their status.
async function eligibleVenueRows(businessId, client = pool) {
  const { rows } = await client.query(
    `select * from venues where business_id = $1 and status = 'approved'
     order by created_at`,
    [businessId]
  );
  return rows;
}

async function getByOwnerId(ownerId, client = pool) {
  const { rows } = await client.query(
    `select * from businesses where owner_id = $1`,
    [ownerId]
  );
  return rows[0] || null;
}

async function getById(id, client = pool) {
  const { rows } = await client.query(`select * from businesses where id = $1`, [id]);
  return rows[0] || null;
}

async function ownedBy(userId, businessId, client = pool) {
  const { rows } = await client.query(
    `select 1 from businesses where id = $1 and owner_id = $2`,
    [businessId, userId]
  );
  return rows.length > 0;
}

// Ensure a Business exists for an owner (self-heal: venue creation and owner
// provisioning both call this so a missing row can never dead-end the owner).
// A brand-new Business also gets its payment-method rows (ADR-0044): both
// born disabled — the owner enables them from the Payments page.
async function ensureForOwner(ownerId, name, client = pool) {
  const existing = await getByOwnerId(ownerId, client);
  if (existing) return existing;
  const { rows } = await client.query(
    `insert into businesses (owner_id, name) values ($1, $2)
     on conflict (owner_id) do update set updated_at = now()
     returning *`,
    [ownerId, name || 'My Business']
  );
  const business = rows[0];
  await client.query(
    `insert into business_payment_methods (business_id, method, enabled) values
       ($1, 'cash', false),
       ($1, 'payhere', false)
     on conflict (business_id, method) do nothing`,
    [business.id]
  );
  return business;
}

// Validate + persist name/brand patches. brand is sanitized through the
// shared token validator; unknown keys are dropped server-side. The brand
// object MERGES over the stored brand (Partial semantics: a consumer that
// sends only site-brand fields never loses the business tokens, and vice
// versa — ADR-0031 keeps one shared brand object). Nested objects (colors,
// contact) merge at their own level; sending an explicit empty string clears.
async function updateProfile(businessId, patch, client = pool) {
  const { name, brand, require_2fa } = patch;
  let cleanBrand = null;
  if (brand !== undefined) {
    try {
      cleanBrand = sanitizeBrand(brand);
    } catch (error) {
      throw Object.assign(new Error(error.message), { code: error.code || 'WIDGET_VALIDATION' });
    }
  }
  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 80)) {
    throw Object.assign(new Error('Business name must be 1–80 characters'), { code: 'WIDGET_VALIDATION' });
  }
  if (require_2fa !== undefined && typeof require_2fa !== 'boolean') {
    throw Object.assign(new Error('require_2fa must be a boolean'), { code: 'WIDGET_VALIDATION' });
  }

  if (cleanBrand !== null) {
    const current = await client.query(`select brand from businesses where id = $1`, [businessId]);
    const base = (current.rows[0] && current.rows[0].brand) || {};
    const merged = { ...base, ...cleanBrand };
    if (cleanBrand.colors) merged.colors = { ...(base.colors || {}), ...cleanBrand.colors };
    if (cleanBrand.contact) merged.contact = { ...(base.contact || {}), ...cleanBrand.contact };
    if (cleanBrand.social_links) merged.social_links = { ...(base.social_links || {}), ...cleanBrand.social_links };
    cleanBrand = merged;
  }

  const { rows } = await client.query(
    `update businesses set
       name = coalesce($2, name),
       brand = coalesce($3::jsonb, brand),
       require_2fa = coalesce($4, require_2fa),
       updated_at = now()
     where id = $1
     returning *`,
    [
      businessId,
      name !== undefined ? name.trim() : null,
      cleanBrand !== null ? JSON.stringify(cleanBrand) : null,
      require_2fa === undefined ? null : require_2fa
    ]
  );
  return rows[0] || null;
}

module.exports = { getByOwnerId, getById, ownedBy, ensureForOwner, updateProfile, eligibleVenueRows };