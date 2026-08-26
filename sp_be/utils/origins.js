// Origin allow-lists for REST CORS and Socket.IO. Env origins (FRONTEND_URL,
// SOCKET_ALLOWED_ORIGINS) stay the platform's own surfaces; live Dedicated
// Site hostnames (ADR-0029) are appended at runtime from the DB so an owner's
// custom domain is a trusted origin without a redeploy. Fails closed: an
// origin that matches neither list is denied.

const pool = require('../db');

// Platform origins from env (sync, fallback semantics preserved).
function getEnvOrigins(env = process.env) {
  const list = (env.SOCKET_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : [env.FRONTEND_URL].filter(Boolean);
}

// Full trusted origin set: env + every live site hostname (apex/www twins).
async function getAllowedOrigins(env = process.env) {
  const origins = getEnvOrigins(env);
  try {
    const { rows } = await pool.query(
      `select hostname from site_domain_requests where status = 'live'`
    );
    for (const row of rows) {
      const host = String(row.hostname).toLowerCase();
      origins.push(host);
      if (host.startsWith('www.')) origins.push(host.slice(4));
      else origins.push(`www.${host}`);
    }
  } catch (error) {
    // A missing table (pre-migration boot) must not kill CORS resolution —
    // the env list still applies.
    if (!String(error.message).includes('does not exist')) {
      // eslint-disable-next-line no-console
      console.error('Site hostname origin lookup failed:', error.message);
    }
  }
  return [...new Set(origins)];
}

// CORS origin function for express: resolves the live list per request and
// admits exact or subdomain matches with credentials. Entry matching follows
// the widget allowlist rule: an entry WITHOUT a port matches the hostname on
// any port (local dev `mysite.localhost:3000` matches a stored `mysite.localhost`);
// an entry WITH a port must match both host and port exactly.
function corsOrigin(env = process.env) {
  return async (origin, callback) => {
    if (!origin) return callback(null, true);
    const origins = await getAllowedOrigins(env);
    let url;
    try {
      url = new URL(String(origin).includes('://') ? origin : `https://${origin}`);
    } catch {
      return callback(null, false);
    }
    const host = url.hostname.toLowerCase();
    const port = url.port || null;
    const allowed = origins.some((o) => {
      const oUrl = String(o).includes('://') ? o : `https://${o}`;
      let oHost;
      let oPort = null;
      try {
        const parsed = new URL(oUrl);
        oHost = parsed.hostname.toLowerCase();
        oPort = parsed.port || null;
      } catch {
        return false;
      }
      if (host !== oHost && !host.endsWith(`.${oHost}`)) return false;
      return oPort === null || oPort === port;
    });
    callback(null, allowed);
  };
}

module.exports = { getEnvOrigins, getAllowedOrigins, corsOrigin };