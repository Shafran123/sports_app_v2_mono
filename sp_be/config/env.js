const fs = require('fs');
const os = require('os');
const path = require('path');

const REQUIRED = [
  'DATABASE_URL',
  'FRONTEND_URL',
  'PAYHERE_MERCHANT_ID',
  'PAYHERE_MERCHANT_SECRET',
  'MAILGUN_API_KEY',
  'SMSGO_API_KEY',
  'OTP_HMAC_SECRET',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY'
];

function nodeEnvOf(env) {
  return env.NODE_ENV || 'development';
}

function hasFirebaseCredential(env = process.env) {
  if (env.GOOGLE_APPLICATION_CREDENTIALS && env.GOOGLE_APPLICATION_CREDENTIALS.startsWith('{')) {
    return true;
  }
  if (env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(env.GOOGLE_APPLICATION_CREDENTIALS)) {
    return true;
  }
  if (env.FIREBASE_SERVICE_ACCOUNT) {
    return true;
  }
  const home = env.HOME || os.homedir();
  const adc = path.join(home, '.config', 'gcloud', 'application_default_credentials.json');
  return fs.existsSync(adc);
}

// Fail closed: the API refuses to boot without every secret a live deployment
// needs. Public-string fallbacks in code (PayHere test secret, JWT fallbacks)
// made misconfigured deploys forgeable — missing secrets are now a startup
// error instead. The test environment and local ADC-based dev keep working.
function missingKeys(env = process.env) {
  const missing = REQUIRED.filter((key) => !env[key]);
  if (!hasFirebaseCredential(env) && nodeEnvOf(env) !== 'test') {
    missing.push('GOOGLE_APPLICATION_CREDENTIALS (or FIREBASE_SERVICE_ACCOUNT)');
  }
  if (env.API_PUBLIC_URL && !/^https?:\/\//.test(env.API_PUBLIC_URL)) {
    missing.push('API_PUBLIC_URL (must be an absolute http(s) URL)');
  }
  if (env.SOCKET_ALLOWED_ORIGINS) {
    const origins = env.SOCKET_ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
    if (origins.length === 0) {
      missing.push('SOCKET_ALLOWED_ORIGINS (comma-separated http(s) origins, or unset)');
    } else if (origins.some((o) => !/^https?:\/\//.test(o))) {
      missing.push('SOCKET_ALLOWED_ORIGINS (every origin must be an absolute http(s) URL)');
    }
  }
  return missing;
}

function validate({ env = process.env, nodeEnv = nodeEnvOf(env) } = {}) {
  if (nodeEnv === 'test') {
    return { ok: true, missing: [] };
  }
  const missing = missingKeys(env);
  if (missing.length > 0) {
    const err = new Error(`Missing required env vars: ${missing.join(', ')}`);
    err.code = 'ENV_MISSING';
    throw err;
  }
  return { ok: true, missing: [] };
}

module.exports = { validate, missingKeys, REQUIRED };