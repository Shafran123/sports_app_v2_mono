// Boot-time resolution of Platform Secrets from Google Secret Manager
// (ADR-0046). Only the operator/secret set lives here — per-Business PayHere
// credentials are tenant data in Postgres and never pass through this module.
//
// Enabled by SECRET_MANAGER_CREDENTIALS: a base64-encoded (or raw) service
// account JSON holding only roles/secretmanager.secretAccessor on the platform
// secrets. When it is unset the process reads every secret from env directly
// (local dev, tests) and this module is a no-op.
//
// Injection is "env wins": an already-set value is never overwritten, so a
// developer can override a single secret locally. Runs once at boot, before
// config validation — request-time paths (checkout signing, IPN verification,
// refunds) never touch the manager.

const crypto = require('node:crypto');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SECRET_API = 'https://secretmanager.googleapis.com/v1';

const DEFAULT_PROJECT = 'myslot-preprod';

// env var names of the platform secret set (ADR-0046). The Secret Manager
// secret name equals the env var name. FIREBASE_SERVICE_ACCOUNT is stored
// base64-encoded (the exact value the env var used to hold — firebase-admin
// decodes it), so the raw SA JSON is base64'd when the secret is created.
const PLATFORM_SECRETS = [
  'PAYHERE_MERCHANT_ID',
  'PAYHERE_MERCHANT_SECRET',
  'PAYHERE_AUTHORIZATION',
  'MASTER_ENCRYPTION_KEY',
  'MAILGUN_API_KEY',
  'MAILGUN_DOMAIN',
  'SMSGO_API_KEY',
  'SMSGO_MASK',
  'OTP_HMAC_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
  'FIREBASE_SERVICE_ACCOUNT'
];

function isConfigured(env = process.env) {
  return Boolean(env.SECRET_MANAGER_CREDENTIALS);
}

// Accept either the raw service-account JSON or its base64 encoding (base64
// never starts with '{', so the two are unambiguous).
function parseCredentials(env = process.env) {
  const raw = String(env.SECRET_MANAGER_CREDENTIALS || '').trim();
  if (!raw) throw new Error('SECRET_MANAGER_CREDENTIALS is empty');
  const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('SECRET_MANAGER_CREDENTIALS is not a service-account JSON (or its base64)');
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('SECRET_MANAGER_CREDENTIALS lacks client_email/private_key — not a service-account JSON');
  }
  return parsed;
}

// Sign a Google OAuth JWT assertion with the service account's RSA private
// key (RFC 7523). Dependency-free: node:crypto + global fetch (Node >= 18).
function signAssertion(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600
  };
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const input = `${b64(header)}.${b64(claims)}`;
  const signature = crypto.createSign('RSA-SHA256').update(input).sign(credentials.private_key, 'base64url');
  return `${input}.${signature}`;
}

async function requestAccessToken(credentials, fetchImpl) {
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signAssertion(credentials)
    }).toString()
  });
  if (!res.ok) throw new Error(`GSM token request failed: HTTP ${res.status}`);
  const data = await res.json();
  if (!data.access_token) throw new Error('GSM token request returned no access_token');
  return data.access_token;
}

async function accessSecret(project, name, accessToken, fetchImpl) {
  const url = `${SECRET_API}/projects/${project}/secrets/${name}/versions/latest:access`;
  const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`GSM access failed for ${name}: HTTP ${res.status}`);
  const data = await res.json();
  if (!data.payload || typeof data.payload.data !== 'string') {
    throw new Error(`GSM returned no payload for ${name}`);
  }
  return Buffer.from(data.payload.data, 'base64').toString('utf8');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry(fn, { maxRetries, retryDelayMs }) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) await sleep(retryDelayMs * 2 ** attempt);
    }
  }
  throw lastError;
}

// Resolve the platform secrets into `env` (defaults to process.env).
// Returns { injected, missing, skipped } — arrays of env var names.
// Throws when GSM is configured but a required secret cannot be resolved
// (fail-fast: a backend that can't load its secrets must not serve).
async function loadPlatformSecrets({ env = process.env, maxRetries = 3, retryDelayMs = 300, fetchImpl = fetch } = {}) {
  if (!isConfigured(env)) {
    return { injected: [], missing: [], skipped: PLATFORM_SECRETS.slice() };
  }

  const credentials = parseCredentials(env);
  const project = env.SECRET_MANAGER_PROJECT || DEFAULT_PROJECT;
  const accessToken = await withRetry(
    () => requestAccessToken(credentials, fetchImpl),
    { maxRetries, retryDelayMs }
  );

  // "env wins": values already present are supplied directly and never
  // overwritten (a developer can override a single secret locally).
  const skipped = PLATFORM_SECRETS.filter((envVar) => envVar in env);
  const injected = [];
  const missing = [];
  for (const envVar of PLATFORM_SECRETS) {
    if (skipped.includes(envVar)) continue;
    try {
      const value = await withRetry(
        () => accessSecret(project, envVar, accessToken, fetchImpl),
        { maxRetries, retryDelayMs }
      );
      env[envVar] = value;
      injected.push(envVar);
    } catch (err) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Platform secrets unavailable from Google Secret Manager (${project}): ${missing.join(', ')}`);
  }

  return { injected, missing, skipped };
}

module.exports = {
  PLATFORM_SECRETS,
  isConfigured,
  parseCredentials,
  signAssertion,
  loadPlatformSecrets
};
