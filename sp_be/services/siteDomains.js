// Site Domain Request model (ADR-0029): the per-Business Dedicated Site
// workflow — one hostname per Business, requested by the owner, run through
// the admin queue (requested → approved → dns_pending → verifying → live /
// rejected), verified by automated DNS polling, with a staff checklist inside
// the request. Live hostnames double as runtime-trusted origins (DB-driven
// CORS) and as the gate for site-context bookings.

const crypto = require('node:crypto');
const dns = require('node:dns').promises;
const pool = require('../db');
const { slugify } = require('../utils/widget');

const STATUSES = ['requested', 'approved', 'dns_pending', 'verifying', 'live', 'rejected'];
const CHECKLIST_DEFAULTS = [
  { key: 'auth_domain', label: 'Auth provider authorized domain added', done: false },
  { key: 'hosting_domain', label: 'Hosting domain configured (Vercel project domain)', done: false },
  { key: 'links', label: 'Email / QR / PayHere links verified on the host', done: false }
];

// Normalize a hostname for comparisons: lowercase, strip a trailing dot, peel
// a leading "www." (apex and www are the same site, ADR-0029 Q17), and drop an
// explicit port (a dev browser sends `Host: mysite.localhost:3000`; the stored
// Site Hostname never carries a port).
function normalizeHostname(hostname) {
  return String(hostname || '').trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '').replace(/^www\./, '');
}

function isValidHostname(hostname) {
  return /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(hostname);
}

function verifyToken() {
  return crypto.randomBytes(16).toString('hex');
}

// The site's display hostname (the one we serve the site on): apex keeps its
// own name, a www-submitted custom host is surfaced as apex.
function displayHostname(row) {
  if (!row) return null;
  if (row.hostname_kind === 'subdomain') return row.hostname;
  return row.hostname.startsWith('www.') ? row.hostname.slice(4) : row.hostname;
}

// ---- Validation + request lifecycle ----

function cleanInput({ hostname, hostname_kind }, current = {}) {
  const kind = hostname_kind === 'custom' ? 'custom' : hostname_kind === 'subdomain' ? 'subdomain' : current.hostname_kind;
  if (!kind) {
    throw Object.assign(new Error('hostname_kind is required (custom or subdomain)'), { code: 'SITE_REQUEST_VALIDATION' });
  }
  const raw = String(hostname || '').trim().toLowerCase().replace(/\.$/, '');
  if (!raw || !isValidHostname(raw) || raw.startsWith('-') || raw.endsWith('-')) {
    throw Object.assign(new Error('Enter a valid hostname, e.g. abc.lk or book.abc.lk'), { code: 'SITE_REQUEST_VALIDATION' });
  }
  if (kind === 'subdomain' && !raw.endsWith('.myslot.lk')) {
    throw Object.assign(new Error('Platform subdomains must end with .myslot.lk'), { code: 'SITE_REQUEST_VALIDATION' });
  }
  // Apex + www are one hostname (ADR-0029): a custom host is always stored as
  // the apex and answers on both. This keeps hostname uniqueness exact.
  const host = kind === 'custom' ? raw.replace(/^www\./, '') : raw;
  return { hostname: host, hostname_kind: kind };
}

async function getForBusiness(businessId, client = pool) {
  const { rows } = await client.query(
    `select * from site_domain_requests where business_id = $1`,
    [businessId]
  );
  return rows[0] || null;
}

// Owner submits a request. One per Business — a Business with an existing
// request edits it (see resubmit) instead of creating a second row.
async function request(businessId, input, client = pool) {
  const existing = await getForBusiness(businessId, client);
  if (existing && existing.status !== 'rejected') {
    throw Object.assign(new Error('Your site request is already in progress'), { code: 'SITE_REQUEST_EXISTS' });
  }
  const clean = cleanInput(input, existing || {});
  const token = verifyToken();
  const dnsType = clean.hostname_kind === 'subdomain' ? 'CNAME' : 'TXT';
  const dnsName = clean.hostname;
  // CNAME targets the user app origin (the app serves the site host-based);
  // TXT carries the verification token so the automated verify step can prove
  // the owner controls the host.
  const appHost = (() => {
    try {
      return new URL(process.env.FRONTEND_URL || '').hostname || null;
    } catch {
      return null;
    }
  })();
  const dnsValue = dnsType === 'CNAME' ? appHost || 'cname.myslot.lk' : `myslot-site-verification=${token}`;

  const claimHostname = async () => {
    if (existing) {
      const { rows } = await client.query(
        `update site_domain_requests set
           hostname = $2, hostname_kind = $3, status = 'requested',
           dns_type = $4, dns_name = $5, dns_value = $6,
           rejection_reason = null, notified_at = null, updated_at = now()
         where id = $1
         returning *`,
        [existing.id, clean.hostname, clean.hostname_kind, dnsType, dnsName, dnsValue]
      );
      return rows[0];
    }

    const { rows } = await client.query(
      `insert into site_domain_requests
         (business_id, hostname, hostname_kind, status, dns_type, dns_name, dns_value, checklist)
       values ($1, $2, $3, 'requested', $4, $5, $6, $7::jsonb)
       returning *`,
      [businessId, clean.hostname, clean.hostname_kind, dnsType, dnsName, dnsValue, JSON.stringify(CHECKLIST_DEFAULTS)]
    );
    return rows[0];
  };

  try {
    return await claimHostname();
  } catch (error) {
    if (error.code === '23505') {
      throw Object.assign(new Error('That hostname is already requested by another business'), { code: 'SITE_REQUEST_CONFLICT' });
    }
    throw error;
  }
}

async function getById(id, client = pool) {
  const { rows } = await client.query(`select * from site_domain_requests where id = $1`, [id]);
  return rows[0] || null;
}

async function ownedBy(businessId, requestId, client = pool) {
  const { rows } = await client.query(
    `select 1 from site_domain_requests where id = $1 and business_id = $2`,
    [requestId, businessId]
  );
  return rows.length > 0;
}

async function approve(id, client = pool) {
  return transition(id, 'approved', client);
}

async function markDnsAdded(id, client = pool) {
  return transition(id, 'dns_pending', client);
}

// Automated DNS verification (ADR-0029): the owner adds a TXT record carrying
// `myslot-site-verification=<token>` (or the CNAME for subdomains); this
// checks the live DNS and moves the request to verifying when it resolves.
// Sync DNS lookups against a hostile/missing record fail fast to rejected? No —
// they fail to dns_pending (owner may still be adding the record).
async function verify(id, client = pool) {
  const row = await getById(id, client);
  if (!row) return null;
  if (!['approved', 'dns_pending'].includes(row.status)) {
    throw Object.assign(new Error('Only approved or dns-pending requests can be verified'), { code: 'SITE_REQUEST_BAD_STATE' });
  }
  let found = false;
  try {
    if (row.dns_type === 'CNAME') {
      const records = await dns.resolveCname(row.dns_name);
      found = records.some((r) => normalizeHostname(r) === normalizeHostname(row.dns_value));
    } else {
      const records = await dns.resolveTxt(row.dns_name);
      const flat = records.map((parts) => parts.join('')).join(' ');
      found = row.dns_value && flat.includes(row.dns_value.split('=')[1]);
    }
  } catch {
    found = false;
  }
  const status = found ? 'verifying' : 'dns_pending';
  const { rows } = await client.query(
    `update site_domain_requests set status = $2, updated_at = now() where id = $1 returning *`,
    [id, status]
  );
  return rows[0];
}

async function markLive(id, client = pool) {
  const { rows } = await client.query(
    `update site_domain_requests set status = 'live', live_at = now(), updated_at = now()
     where id = $1 returning *`,
    [id]
  );
  const row = rows[0] || null;
  // Marketplace Listing default-off (ADR-0031): the site-live flip takes the
  // Business's approved venues off the marketplace in the same transition.
  // Best-effort next statement — the request update above is the commit
  // point; a failure here leaves venues listed, never the site half-live.
  if (row) {
    await client.query(
      `update venues set marketplace_listing = false, updated_at = now()
       where business_id = $1 and status = 'approved' and marketplace_listing = true`,
      [row.business_id]
    );
  }
  return row;
}

async function reject(id, reason, client = pool) {
  if (!reason || !String(reason).trim()) {
    throw Object.assign(new Error('A rejection reason is required'), { code: 'SITE_REQUEST_VALIDATION' });
  }
  const { rows } = await client.query(
    `update site_domain_requests set status = 'rejected', rejection_reason = $2, updated_at = now()
     where id = $1 returning *`,
    [id, String(reason).trim().slice(0, 500)]
  );
  return rows[0] || null;
}

async function transition(id, status, client = pool) {
  const { rows } = await client.query(
    `update site_domain_requests set status = $2, updated_at = now() where id = $1 returning *`,
    [id, status]
  );
  return rows[0] || null;
}

// Staff checklist updates: item key -> done flag, persisted inside the row.
async function setChecklistItem(id, key, done, client = pool) {
  const row = await getById(id, client);
  if (!row) return null;
  const items = Array.isArray(row.checklist) ? row.checklist : [];
  const next = items.map((item) => (item.key === key ? { ...item, done: !!done } : item));
  if (!next.some((item) => item.key === key)) {
    next.push({ key, label: key, done: !!done });
  }
  const { rows } = await client.query(
    `update site_domain_requests set checklist = $2::jsonb, updated_at = now() where id = $1 returning *`,
    [id, JSON.stringify(next)]
  );
  return rows[0];
}

// ---- Admin queue ----

async function listAll(client = pool) {
  const { rows } = await client.query(
    `select r.*, b.name as business_name,
            u.email as owner_email, u.name as owner_name,
            (select count(*)::int from venues v where v.business_id = r.business_id) as venue_count
     from site_domain_requests r
     join businesses b on b.id = r.business_id
     left join users u on u.id = b.owner_id
     order by r.created_at desc`
  );
  return rows;
}

// ---- Public resolution ----

// Resolve a request by hostname (normalized; a live www and apex are the same
// site). Used by the public site route and the middleware that decides whether
// a host is a Dedicated Site. Null unless the request is live.
async function liveByHostname(hostname, client = pool) {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return null;
  const { rows } = await client.query(
    `select r.*, b.name as business_name, b.brand as business_brand, b.id as business_id
     from site_domain_requests r
     join businesses b on b.id = r.business_id
     where r.status = 'live' and lower(r.hostname) = $1`,
    [normalized]
  );
  if (rows.length > 0) return rows[0];
  // Apex/www equivalence: a live `abc.lk` answers on `www.abc.lk`, and a live
  // `www.abc.lk` (rejected hosts are normalized at request time so this is the
  // custom-kind www form) answers on its apex.
  const { rows: www } = await client.query(
    `select r.*, b.name as business_name, b.brand as business_brand, b.id as business_id
     from site_domain_requests r
     join businesses b on b.id = r.business_id
     where r.status = 'live' and lower(r.hostname) = $1`,
    [normalized.startsWith('www.') ? normalized.slice(4) : `www.${normalized}`]
  );
  return www[0] || null;
}

// Every live hostname + its www twin — the DB-driven trusted-origin set.
async function liveHostnames(client = pool) {
  const { rows } = await client.query(
    `select hostname, hostname_kind from site_domain_requests where status = 'live'`
  );
  const out = [];
  for (const row of rows) {
    out.push(row.hostname);
    if (row.hostname_kind === 'custom' || row.hostname.startsWith('www.')) {
      out.push(row.hostname.startsWith('www.') ? row.hostname.slice(4) : `www.${row.hostname}`);
    }
  }
  return out;
}

// Checkout-time site scoping: a presented site_hostname must be a LIVE site
// of the court's own Business (a site can never book another business's
// venue). Returns { ok } or { error: { status, code, message } }.
async function validateSiteHostname(client, venueId, hostname) {
  const requestRow = await liveByHostname(hostname, client);
  if (!requestRow) {
    return { error: { status: 403, code: 'SITE_HOST_NOT_LIVE', message: 'This hostname is not a live dedicated site' } };
  }
  const { rows } = await client.query(
    `select business_id from venues where id = $1 and status = 'approved'`,
    [venueId]
  );
  const venue = rows[0];
  if (!venue || venue.business_id !== requestRow.business_id) {
    return { error: { status: 403, code: 'SITE_HOST_VENUE_MISMATCH', message: 'This venue does not belong to this dedicated site' } };
  }
  return { ok: true };
}

// Owner console toggle (ADR-0031): a venue of a live-site business flips its
// Marketplace Listing on (sell dual-channel: site + marketplace) or back off.
// Only approved venues of the Business may be toggled; non-live-site
// businesses keep the default-on state and have nothing to toggle.
async function setMarketplaceListing(businessId, venueId, enabled, client = pool) {
  const { rows } = await client.query(
    `update venues v set marketplace_listing = $3, updated_at = now()
     from site_domain_requests r
     where v.id = $2 and v.business_id = $1 and v.status = 'approved'
       and r.business_id = $1 and r.status = 'live'
     returning v.id, v.name, v.marketplace_listing`,
    [businessId, venueId, !!enabled]
  );
  return rows[0] || null;
}

// Suggest a platform subdomain from the business name (e.g. "abc sports" →
// abc-sports.myslot.lk) — the owner's default choice in the request form.
function suggestSubdomain(businessName) {
  const base = slugify(businessName).slice(0, 40).replace(/-+$/, '');
  return base ? `${base}.myslot.lk` : null;
}

module.exports = {
  STATUSES,
  CHECKLIST_DEFAULTS,
  normalizeHostname,
  isValidHostname,
  getForBusiness,
  request,
  getById,
  ownedBy,
  approve,
  markDnsAdded,
  verify,
  markLive,
  reject,
  setChecklistItem,
  listAll,
  liveByHostname,
  liveHostnames,
  setMarketplaceListing,
  validateSiteHostname,
  displayHostname,
  suggestSubdomain
};