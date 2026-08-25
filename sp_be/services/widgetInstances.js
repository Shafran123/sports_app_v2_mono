// Widget Instance model (ADR-0028 amendment v1.5): one embeddable booking
// surface of a Business. An instance carries its own embed key, a Default
// Venue, a "let customers choose venue" toggle, a domain allowlist, and an
// enabled switch. All reads/writes are scoped to the owning Business; the
// same module validates widget-scope at checkout.

const pool = require('../db');
const { mintWidgetKey, sanitizeDomains } = require('../utils/widget');
const { eligibleVenueRows } = require('./businesses');

const INSTANCE_NAME_MAX = 60;

// An instance's effective scope degrades rather than dead-ends: a default
// venue that is no longer eligible (e.g. suspended) falls back to
// free venue choice with no preselect — never a widget that books nothing.
function effectiveScope(instance, eligibleIds) {
  const values = new Set(eligibleIds);
  const defaultOk = !!instance.default_venue_id && values.has(instance.default_venue_id);
  return {
    default_venue_id: defaultOk ? instance.default_venue_id : null,
    allow_venue_choice: instance.allow_venue_choice || !defaultOk
  };
}

// Resolve the embed key -> enabled instance of a Business. Unknown or
// disabled keys read as null so the public API never leaks existence.
async function instanceByEmbedKey(key, client = pool) {
  const { rows } = await client.query(
    `select wi.*, b.name as business_name, b.brand as business_brand, b.owner_id as business_owner_id
     from widget_instances wi
     join businesses b on b.id = wi.business_id
     where wi.embed_key = $1 and wi.enabled`,
    [key]
  );
  return rows[0] || null;
}

async function listForBusiness(businessId, client = pool) {
  const { rows } = await client.query(
    `select wi.*, v.name as default_venue_name, v.status as default_venue_status
     from widget_instances wi
     left join venues v on v.id = wi.default_venue_id
     where wi.business_id = $1
     order by wi.created_at`,
    [businessId]
  );
  return rows;
}

async function getById(id, client = pool) {
  const { rows } = await client.query(
    `select wi.*, v.name as default_venue_name, v.status as default_venue_status
     from widget_instances wi
     left join venues v on v.id = wi.default_venue_id
     where wi.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function ownedBy(businessId, instanceId, client = pool) {
  const { rows } = await client.query(
    `select 1 from widget_instances where id = $1 and business_id = $2`,
    [instanceId, businessId]
  );
  return rows.length > 0;
}

// defaultVenueId must be an approved venue of the SAME business — an owner
// can never pin an instance to a venue they do not run.
async function validateDefaultVenue(client, businessId, venueId) {
  const { rows } = await client.query(
    `select 1 from venues where id = $1 and business_id = $2 and status = 'approved'`,
    [venueId, businessId]
  );
  return rows.length > 0;
}

function cleanInput({ name, default_venue_id, allow_venue_choice, allowed_domains, enabled }) {
  const out = {};
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > INSTANCE_NAME_MAX) {
      throw Object.assign(new Error(`Instance name must be 1–${INSTANCE_NAME_MAX} characters`), { code: 'WIDGET_VALIDATION' });
    }
    out.name = name.trim();
  }
  if (default_venue_id !== undefined) out.default_venue_id = default_venue_id || null;
  if (allow_venue_choice !== undefined) out.allow_venue_choice = !!allow_venue_choice;
  if (allowed_domains !== undefined) {
    try {
      out.allowed_domains = sanitizeDomains(allowed_domains);
    } catch (error) {
      throw Object.assign(new Error(error.message), { code: 'WIDGET_VALIDATION' });
    }
  }
  if (enabled !== undefined) out.enabled = !!enabled;
  return out;
}

async function create(businessId, input, client = pool) {
  const clean = cleanInput(input);
  if (!clean.name) {
    throw Object.assign(new Error(`Instance name must be 1–${INSTANCE_NAME_MAX} characters`), { code: 'WIDGET_VALIDATION' });
  }
  if (clean.default_venue_id && !(await validateDefaultVenue(client, businessId, clean.default_venue_id))) {
    throw Object.assign(new Error('Default venue must be one of your approved venues'), { code: 'WIDGET_VALIDATION' });
  }
  const { rows } = await client.query(
    `insert into widget_instances (business_id, name, embed_key, default_venue_id, allow_venue_choice, allowed_domains)
     values ($1, $2, $3, $4, $5, $6::jsonb)
     returning *`,
    [
      businessId,
      clean.name,
      mintWidgetKey(),
      clean.default_venue_id || null,
      clean.allow_venue_choice === undefined ? true : clean.allow_venue_choice,
      JSON.stringify(clean.allowed_domains || [])
    ]
  );
  return rows[0];
}

async function update(instanceId, input, client = pool) {
  const clean = cleanInput(input);
  if (Object.keys(clean).length === 0) return null;

  if (clean.default_venue_id !== undefined && clean.default_venue_id !== null) {
    const { rows } = await client.query(
      `select business_id from widget_instances where id = $1`,
      [instanceId]
    );
    if (rows.length === 0) return null;
    if (!(await validateDefaultVenue(client, rows[0].business_id, clean.default_venue_id))) {
      throw Object.assign(new Error('Default venue must be one of your approved venues'), { code: 'WIDGET_VALIDATION' });
    }
  }

  const { rows } = await client.query(
    `update widget_instances set
       name = coalesce($2, name),
       default_venue_id = case when $3::uuid is null and $4 then default_venue_id else $3::uuid end,
       allow_venue_choice = coalesce($5, allow_venue_choice),
       allowed_domains = coalesce($6::jsonb, allowed_domains),
       enabled = coalesce($7, enabled),
       updated_at = now()
     where id = $1
     returning *`,
    [
      instanceId,
      clean.name ?? null,
      clean.default_venue_id ?? null,
      clean.default_venue_id === undefined,
      clean.allow_venue_choice === undefined ? null : clean.allow_venue_choice,
      clean.allowed_domains !== undefined ? JSON.stringify(clean.allowed_domains) : null,
      clean.enabled === undefined ? null : !!clean.enabled
    ]
  );
  return rows[0] || null;
}

async function remove(instanceId, client = pool) {
  await client.query(`delete from widget_instances where id = $1`, [instanceId]);
}

// Checkout-time scoping (ticket 05): a widget booking must provably sit
// inside the instance's scope on the server. Uses the SAME effective scope
// as the public config, so a degraded instance (default venue no longer
// eligible) degrades here too — never a UI that books nothing. Returns
// { ok } or { error: { status, code, message } }.
async function validateWidgetScope(client, venueId, embedKey) {
  const { rows } = await client.query(
    `select wi.* from widget_instances wi where wi.embed_key = $1`,
    [embedKey]
  );
  if (rows.length === 0 || !rows[0].enabled) {
    return { error: { status: 403, code: 'WIDGET_INSTANCE_DISABLED', message: 'This booking widget is not available' } };
  }
  const instance = rows[0];

  const eligible = await eligibleVenueRows(instance.business_id, client);
  const scope = effectiveScope(instance, eligible.map((v) => v.id));
  if (!eligible.some((v) => v.id === venueId)) {
    return { error: { status: 403, code: 'WIDGET_VENUE_NOT_ELIGIBLE', message: 'This venue is not part of this booking widget' } };
  }
  if (!scope.allow_venue_choice && scope.default_venue_id !== venueId) {
    return { error: { status: 403, code: 'WIDGET_VENUE_LOCKED', message: 'This venue is not the widget\'s default venue' } };
  }
  return { ok: true, instance: { ...instance, ...scope } };
}

// Full instance payload for the console editor: instance + eligible venues.
async function consoleDetail(businessId, instanceId, client = pool) {
  const instance = await getById(instanceId, client);
  if (!instance || instance.business_id !== businessId) return null;
  const eligible = await eligibleVenueRows(businessId, client);
  return { ...instance, venues: eligible };
}

module.exports = {
  instanceByEmbedKey,
  listForBusiness,
  getById,
  ownedBy,
  create,
  update,
  remove,
  effectiveScope,
  validateWidgetScope,
  consoleDetail,
  eligibleVenueRows
};