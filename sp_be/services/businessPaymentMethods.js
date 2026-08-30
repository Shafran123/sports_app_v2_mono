// Per-Business payment methods (ADR-0044): rows in business_payment_methods
// hold only the non-secret config — enabled flags and the merchant/app IDs.
// The two secrets (merchant_secret, app_secret) live in Google Secret
// Manager, one secret per Business (ADR-0047), resolved through an in-memory
// cache with a short TTL so IPN verification and checkout-param signing
// never block on the manager per request. The cache is invalidated on owner
// save/remove. Without SECRET_MANAGER_CREDENTIALS (local dev, tests) the
// platform env keys stand in for the business credentials.

const pool = require('../db');
const axios = require('axios');
const logger = require('../utils/logger');
const secretManager = require('./secretManager');

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // business_id -> { expires_at, creds }

// The PayHere OAuth token endpoint proves an app_id/app_secret pair (the
// refund-API credentials). Sandbox by default until launch flips the URL.
const OAUTH_TOKEN_URL =
  process.env.PAYHERE_OAUTH_TOKEN_URL || 'https://sandbox.payhere.lk/merchant/v1/oauth/token';

// Single OAuth implementation for the owner app credentials: used both to
// validate an app pair at save time and to mint the Bearer token a refund
// posts with (ADR-0044). Throws when the pair is rejected.
async function businessAccessToken(appId, appSecret) {
  const basic = Buffer.from(`${appId}:${appSecret}`).toString('base64');
  const res = await axios.post(
    OAUTH_TOKEN_URL,
    'grant_type=client_credentials',
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basic}` } }
  );
  if (!res.data || !res.data.access_token) {
    throw new Error('PayHere OAuth token missing');
  }
  return res.data.access_token;
}

// ---- Public read shape -----------------------------------------------------

async function getMethods(businessId, client = pool) {
  const { rows } = await client.query(
    `select method, enabled, merchant_id, app_id
     from business_payment_methods
     where business_id = $1`,
    [businessId]
  );
  return rows;
}

// The checkout gate + owner console both consume this: enabled flags plus the
// PayHere credential state, never any secret material.
async function getMethodsSummary(businessId, client = pool) {
  const rows = await getMethods(businessId, client);
  const cash = rows.find((r) => r.method === 'cash');
  const payhere = rows.find((r) => r.method === 'payhere');
  return {
    cash_enabled: Boolean(cash && cash.enabled),
    payhere_enabled: Boolean(payhere && payhere.enabled),
    payhere_configured: Boolean(payhere && payhere.merchant_id && payhere.app_id)
  };
}

// ---- Owner console endpoints (paymentMethodsController) --------------------

// The app_id/app_secret pair is validated against PayHere's OAuth endpoint
// before anything is stored — an invalid pair is rejected at save time.
async function validateAppPair(appId, appSecret) {
  try {
    await businessAccessToken(appId, appSecret);
    return true;
  } catch (error) {
    logger.error(`PayHere app-pair validation error: ${error.message}`);
    return false;
  }
}

async function setMethodEnabled(businessId, method, enabled) {
  if (!['cash', 'payhere'].includes(method)) {
    const err = new Error('Unknown payment method');
    err.code = 'PAYMENT_METHOD_INVALID';
    throw err;
  }

  const { rows } = await pool.query(
    `select method, enabled, merchant_id, app_id from business_payment_methods
     where business_id = $1`,
    [businessId]
  );
  if (!rows.some((r) => r.method === method)) {
    const err = new Error('Payment method not found');
    err.code = 'PAYMENT_METHOD_NOT_FOUND';
    throw err;
  }

  // At-least-one guard (Q19): a Business can never end up with no payment
  // method enabled — checkout fail-closes (ADR-0015) on none.
  const otherEnabled = rows.some((r) => r.method !== method && r.enabled);
  if (enabled === false && !otherEnabled) {
    const err = new Error('At least one payment method must stay enabled');
    err.code = 'AT_LEAST_ONE_METHOD_REQUIRED';
    throw err;
  }

  // PayHere can only be turned on with working credentials (Q11).
  const payhereRow = rows.find((r) => r.method === 'payhere');
  if (method === 'payhere' && enabled && !(payhereRow && payhereRow.merchant_id && payhereRow.app_id)) {
    const err = new Error('Save your PayHere credentials before enabling PayHere');
    err.code = 'PAYHERE_NOT_CONFIGURED';
    throw err;
  }

  const updated = await pool.query(
    `update business_payment_methods set enabled = $3, updated_at = now()
     where business_id = $1 and method = $2
     returning method, enabled`,
    [businessId, method, Boolean(enabled)]
  );
  invalidateCredentials(businessId);
  return updated.rows[0];
}

// Save the owner's PayHere credentials. The app pair is validated first; the
// secrets go to Google Secret Manager (one secret per Business), never the
// DB — the row only keeps the non-secret IDs.
async function savePayhereCredentials(businessId, { merchant_id, merchant_secret, app_id, app_secret }) {
  if (!merchant_id || !merchant_secret || !app_id || !app_secret) {
    const err = new Error('Merchant ID, merchant secret, app ID and app secret are all required');
    err.code = 'PAYHERE_CREDENTIALS_VALIDATION';
    throw err;
  }
  if (!secretManager.isConfigured()) {
    const err = new Error('Configure Google Secret Manager (SECRET_MANAGER_CREDENTIALS) to store PayHere credentials');
    err.code = 'PAYHERE_SECRET_MANAGER_REQUIRED';
    throw err;
  }
  const appValid = await validateAppPair(app_id, app_secret);
  if (!appValid) {
    const err = new Error('The PayHere app ID and app secret are invalid — check them and try again');
    err.code = 'PAYHERE_APP_CREDENTIALS_INVALID';
    throw err;
  }
  await secretManager.putCredentials(businessId, { merchant_id, merchant_secret, app_id, app_secret });
  await pool.query(
    `insert into business_payment_methods (business_id, method, enabled, merchant_id, app_id)
     values ($1, 'payhere', false, $2, $3)
     on conflict (business_id, method) do update set
       merchant_id = excluded.merchant_id,
       app_id = excluded.app_id,
       updated_at = now()`,
    [businessId, merchant_id.trim(), app_id.trim()]
  );
  invalidateCredentials(businessId);
}

// "Remove keys" (Q14): deletes the GSM secret outright and flips PayHere off
// — a separate action from merely disabling.
async function removePayhereCredentials(businessId) {
  const { rows } = await pool.query(
    `select enabled from business_payment_methods
     where business_id = $1 and method = 'cash'`,
    [businessId]
  );
  // Guard: removing keys also disables PayHere, so cash must be on — the
  // at-least-one rule (Q19) still holds.
  const cashEnabled = rows.length > 0 && rows[0].enabled;
  if (!cashEnabled) {
    const err = new Error('Enable cash first — at least one payment method must stay enabled');
    err.code = 'AT_LEAST_ONE_METHOD_REQUIRED';
    throw err;
  }
  if (secretManager.isConfigured()) {
    await secretManager.deleteCredentials(businessId);
  }
  await pool.query(
    `update business_payment_methods set
       enabled = false, merchant_id = null, app_id = null, updated_at = now()
     where business_id = $1 and method = 'payhere'`,
    [businessId]
  );
  invalidateCredentials(businessId);
}

// ---- Credential resolution (IPN, checkout params, refunds) ----------------

function invalidateCredentials(businessId) {
  cache.delete(businessId);
}

async function resolvePayhereCredentials(businessId) {
  const hit = cache.get(businessId);
  if (hit && hit.expires_at > Date.now()) return hit.creds;
  let creds = null;
  if (secretManager.isConfigured()) {
    try {
      creds = await secretManager.getCredentials(businessId);
    } catch (error) {
      // Transient manager failure: fail-closed for this request but cache
      // nothing, so the next call retries instead of serving a stale "no
      // credentials" verdict for the TTL.
      logger.error(`Business ${businessId}: payhere credentials unavailable from Secret Manager: ${error.message}`);
      return null;
    }
    if (creds && (!creds.merchantId || !creds.merchantSecret)) {
      logger.error(`Business ${businessId}: payhere credentials stored but malformed`);
      creds = null;
    }
  } else {
    // No Secret Manager (local dev, tests): the platform env keys stand in
    // for the business credentials — the same values checkout/IPN tests sign
    // with (setupFiles.mjs). Production always configures GSM, so this path
    // never resolves real business credentials to the platform gateway.
    creds = {
      merchantId: process.env.PAYHERE_MERCHANT_ID,
      merchantSecret: process.env.PAYHERE_MERCHANT_SECRET
    };
  }
  cache.set(businessId, { expires_at: Date.now() + CACHE_TTL_MS, creds });
  return creds;
}

// The checkout-params signing credentials for a booking flow (ADR-0044).
// Fail-closed: no platform fallback — a Business whose PayHere creds are
// missing/unresolvable must not mint a payment on the wrong gateway. Callers
// reject the checkout when this returns null.
async function resolveCheckoutCreds(businessId) {
  if (!businessId) return null;
  return resolvePayhereCredentials(businessId);
}

module.exports = {
  getMethods,
  getMethodsSummary,
  validateAppPair,
  businessAccessToken,
  setMethodEnabled,
  savePayhereCredentials,
  removePayhereCredentials,
  resolvePayhereCredentials,
  resolveCheckoutCreds,
  invalidateCredentials
};