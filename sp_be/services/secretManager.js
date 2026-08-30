// Google Secret Manager client for the per-Business PayHere credentials
// (ADR-0047): one secret per Business named `business-payhere-<businessId>`,
// payload a JSON blob of the four PayHere fields the owner supplies. A new
// save adds a new secret version (no redeploy); "remove keys" deletes the
// secret outright.
//
// Enabled by SECRET_MANAGER_CREDENTIALS: a base64-encoded (or raw) service
// account JSON with accessor + creator + version-adder on the project
// (SECRET_MANAGER_PROJECT, default `myslot-preprod`). Deliberately its own
// var — GOOGLE_APPLICATION_CREDENTIALS is consumed by firebase-admin. When
// it is unset (local dev, tests) businessPaymentMethods falls back to the
// platform env keys and the owner save/remove endpoints refuse to run.

const crypto = require('node:crypto');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SECRET_API = 'https://secretmanager.googleapis.com/v1';

const DEFAULT_PROJECT = 'myslot-preprod';

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

let tokenCache = { value: null, expiresAt: 0 };

async function requestAccessToken(credentials, fetchImpl) {
  if (tokenCache.value && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.value;
  }
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
  tokenCache = { value: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  return data.access_token;
}

function secretPath(project, businessId) {
  return `projects/${project}/secrets/business-payhere-${businessId}`;
}

async function accessSecret(project, businessId, accessToken, fetchImpl) {
  const url = `${SECRET_API}/${secretPath(project, businessId)}/versions/latest:access`;
  const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GSM access failed for ${businessId}: HTTP ${res.status}`);
  const data = await res.json();
  if (!data.payload || typeof data.payload.data !== 'string') {
    throw new Error(`GSM returned no payload for ${businessId}`);
  }
  return Buffer.from(data.payload.data, 'base64').toString('utf8');
}

async function secretExists(project, businessId, accessToken, fetchImpl) {
  const url = `${SECRET_API}/${secretPath(project, businessId)}`;
  const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`GSM lookup failed for ${businessId}: HTTP ${res.status}`);
  return true;
}

async function createSecret(project, businessId, accessToken, fetchImpl) {
  const url = `${SECRET_API}/projects/${project}/secrets?secretId=${encodeURIComponent(`business-payhere-${businessId}`)}`;
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ replication: { automatic: {} } })
  });
  if (!res.ok && res.status !== 409) {
    throw new Error(`GSM create failed for ${businessId}: HTTP ${res.status}`);
  }
}

async function addSecretVersion(project, businessId, payloadJson, accessToken, fetchImpl) {
  const url = `${SECRET_API}/${secretPath(project, businessId)}:addVersion`;
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload: { data: Buffer.from(payloadJson, 'utf8').toString('base64') } })
  });
  if (!res.ok) throw new Error(`GSM addVersion failed for ${businessId}: HTTP ${res.status}`);
}

async function deleteSecret(project, businessId, accessToken, fetchImpl) {
  const url = `${SECRET_API}/${secretPath(project, businessId)}`;
  const res = await fetchImpl(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`GSM delete failed for ${businessId}: HTTP ${res.status}`);
  }
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

function projectOf(env = process.env) {
  return env.SECRET_MANAGER_PROJECT || DEFAULT_PROJECT;
}

// Resolve a Business's PayHere credentials from GSM. Returns null when the
// Business has no secret (never a platform fallback — fail-closed). Throws
// on transient errors so callers can distinguish "not configured" from
// "manager down".
async function getCredentials(businessId, { maxRetries = 3, retryDelayMs = 300, fetchImpl = fetch } = {}) {
  const credentials = parseCredentials();
  const project = projectOf();
  const accessToken = await withRetry(
    () => requestAccessToken(credentials, fetchImpl),
    { maxRetries, retryDelayMs }
  );
  const raw = await withRetry(
    () => accessSecret(project, businessId, accessToken, fetchImpl),
    { maxRetries, retryDelayMs }
  );
  if (raw === null) return null;
  const parsed = JSON.parse(raw);
  return {
    merchantId: parsed.merchant_id,
    merchantSecret: parsed.merchant_secret,
    appId: parsed.app_id,
    appSecret: parsed.app_secret
  };
}

// Store (or rotate) a Business's credentials: creates the secret on first
// save, adds a new version afterwards (a 409 from create means it already
// exists — the addVersion below rotates it).
async function putCredentials(businessId, creds, { maxRetries = 3, retryDelayMs = 300, fetchImpl = fetch } = {}) {
  const credentials = parseCredentials();
  const project = projectOf();
  const accessToken = await withRetry(
    () => requestAccessToken(credentials, fetchImpl),
    { maxRetries, retryDelayMs }
  );
  await withRetry(() => createSecret(project, businessId, accessToken, fetchImpl), { maxRetries, retryDelayMs });
  await withRetry(
    () => addSecretVersion(project, businessId, JSON.stringify(creds), accessToken, fetchImpl),
    { maxRetries, retryDelayMs }
  );
}

// Remove a Business's credentials: deletes the secret and every version.
async function deleteCredentials(businessId, { maxRetries = 3, retryDelayMs = 300, fetchImpl = fetch } = {}) {
  const credentials = parseCredentials();
  const project = projectOf();
  const accessToken = await withRetry(
    () => requestAccessToken(credentials, fetchImpl),
    { maxRetries, retryDelayMs }
  );
  await withRetry(() => deleteSecret(project, businessId, accessToken, fetchImpl), { maxRetries, retryDelayMs });
}

module.exports = {
  isConfigured,
  parseCredentials,
  signAssertion,
  getCredentials,
  putCredentials,
  deleteCredentials
};