const pool = require('../db');

// Canonical registry of platform feature flags. Single source of truth for
// what flags exist, their types, defaults, and admin-facing descriptions.
// Values are stored in platform_config and read live on every gated request
// (direct DB read — no caching, so admin changes propagate instantly).
const FLAG_DEFS = {
  phone_verification_required: {
    type: 'boolean',
    default: false,
    description: 'Require a verified phone number (SMS OTP) before players can create court bookings.'
  },
  sms_enabled: {
    type: 'boolean',
    default: false,
    description: 'Allow outbound transactional SMS (booking confirmation, admin cancellation, OTP codes). When off, SMS is silently skipped.'
  },
  payhere_enabled: {
    type: 'boolean',
    default: false,
    description: 'Allow online payments via PayHere. When off, checkout offers pay-at-venue (cash) only.'
  },
  events_discovery_state: {
    type: 'enum',
    values: ['enabled', 'coming_soon', 'hidden'],
    default: 'enabled',
    description: 'How Events appear to players: enabled (purchasable), coming_soon (teaser cards), or hidden (section removed).'
  }
};

const CONFIG_KEYS = Object.keys(FLAG_DEFS);

function coerce(type, value) {
  if (value === null || value === undefined) return undefined;
  if (type === 'boolean') return value === true || value === 'true';
  if (type === 'number') return Number(value);
  return String(value);
}

async function readConfig(key, fallback) {
  const { rows } = await pool.query('select value from platform_config where key = $1', [key]);
  if (rows.length === 0 || rows[0].value === null || rows[0].value === undefined) {
    return fallback;
  }
  return rows[0].value;
}

/** Current value of a flag (live DB read), falling back to its registry default. */
async function getFlag(name) {
  const def = FLAG_DEFS[name];
  if (!def) return undefined;
  const value = await readConfig(name, def.default);
  return coerce(def.type, value);
}

/** Snapshot of every flag's current value. */
async function getFlags() {
  const out = {};
  for (const name of CONFIG_KEYS) {
    out[name] = await getFlag(name);
  }
  return out;
}

/** Registry metadata + current values, for the admin console. */
async function listFlagStates() {
  const current = await getFlags();
  return CONFIG_KEYS.map((name) => ({ name, ...FLAG_DEFS[name], value: current[name] }));
}

// Platform-wide tax rate (percent, integer LKR math). 0 = no tax.
async function getTaxRate() {
  return coerce('number', await readConfig('tax_rate', 0));
}

async function getBrandName() {
  return String(await readConfig('brand_name', 'MySlot.LK'));
}

// Half-up rounding — matches Postgres round() semantics; used to derive the
// tax line at checkout so totals stay integer LKR.
function halfUp(n) {
  return Math.round(n + 1e-9);
}

// Apply the current tax rate to a base amount (server-side, exclusive tax).
// Returns { base, rate, tax, total } where total = base + tax.
function applyTax(base, rate) {
  const tax = halfUp(base * rate / 100);
  return { base, rate, tax, total: base + tax };
}

// Persist a new value with validation + audit trail. Admin only.
const EXTRA_CONFIG_KEYS = ['tax_rate', 'brand_name'];

async function setConfig(key, value, adminId) {
  const def = FLAG_DEFS[key];
  if (!def && !EXTRA_CONFIG_KEYS.includes(key)) {
    const allowed = [...CONFIG_KEYS, ...EXTRA_CONFIG_KEYS].join(', ');
    throw Object.assign(new Error(`Unknown config key "${key}". Allowed: ${allowed}`), { code: 'UNKNOWN_CONFIG' });
  }

  let parsed;
  if (key === 'tax_rate') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw Object.assign(new Error('tax_rate must be a number'), { code: 'INVALID_VALUE' });
    }
    if (value < 0 || value > 100) {
      throw Object.assign(new Error('tax_rate must be between 0 and 100'), { code: 'INVALID_VALUE' });
    }
    parsed = value;
  } else if (key === 'brand_name') {
    if (typeof value !== 'string') {
      throw Object.assign(new Error('brand_name must be a string'), { code: 'INVALID_VALUE' });
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw Object.assign(new Error('brand_name must not be empty'), { code: 'INVALID_VALUE' });
    }
    if (trimmed.length > 40) {
      throw Object.assign(new Error('brand_name must be 40 characters or fewer'), { code: 'INVALID_VALUE' });
    }
    parsed = trimmed;
  } else if (def.type === 'boolean') {
    if (value === true || value === 'true') parsed = true;
    else if (value === false || value === 'false') parsed = false;
    else throw Object.assign(new Error('value must be true or false'), { code: 'INVALID_VALUE' });
  } else if (def.type === 'enum') {
    if (!def.values.includes(value)) {
      throw Object.assign(new Error(`value must be one of: ${def.values.join(', ')}`), { code: 'INVALID_VALUE' });
    }
    parsed = value;
  }

  const previous = await readConfig(key, def ? def.default : null);

  await pool.query('begin');
  try {
    await pool.query(
      `insert into platform_config (key, value, updated_at) values ($1, $2, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [key, JSON.stringify(parsed)]
    );
    await pool.query(
      `insert into flag_audits (admin_id, key, old_value, new_value) values ($1, $2, $3, $4)`,
      [adminId || null, key, JSON.stringify(previous), JSON.stringify(parsed)]
    );
    await pool.query('commit');
  } catch (error) {
    await pool.query('rollback').catch(() => {});
    throw error;
  }
  return parsed;
}

module.exports = {
  FLAG_DEFS,
  CONFIG_KEYS,
  listFlagStates,
  getFlag,
  getFlags,
  getTaxRate,
  getBrandName,
  applyTax,
  setConfig
};