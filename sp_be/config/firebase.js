const admin = require('firebase-admin');
const fs = require('fs');
const os = require('os');
const path = require('path');
const logger = require('../utils/logger');

// Node >= 22 removed SlowBuffer (deprecated since Node 9), but firebase-admin's
// ID-token path pulls in jsonwebtoken -> jwa -> buffer-equal-constant-time,
// which reads `SlowBuffer.prototype` at load time. Without a shim, every
// token verification crashes on modern Node with
// "Cannot read properties of undefined (reading 'prototype')". The package
// never constructs SlowBuffer — it only aliases .equals/.equal onto it — so
// a bare Buffer subclass is a faithful stand-in.
const nodeBuffer = require('buffer');
if (!nodeBuffer.SlowBuffer) {
  nodeBuffer.SlowBuffer = class SlowBuffer extends Buffer {};
}

let initialized = false;

/**
 * Bootstraps firebase-admin exactly once, resolving credentials in order:
 *   1. GOOGLE_APPLICATION_CREDENTIALS — path to the service-account JSON (Firebase console)
 *   2. FIREBASE_SERVICE_ACCOUNT — base64-encoded service-account JSON
 *   3. ~/.config/gcloud/application_default_credentials.json — local ADC fallback (dev only)
 * Logs a loud startup warning if no usable credential is found — auth endpoints will
 * reject tokens until a credential is provided.
 */
function initFirebase() {
  if (initialized) return admin;
  initialized = true;

  const candidates = [];
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    candidates.push({ source: 'GOOGLE_APPLICATION_CREDENTIALS', value: process.env.GOOGLE_APPLICATION_CREDENTIALS });
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8');
      candidates.push({ source: 'FIREBASE_SERVICE_ACCOUNT', value: decoded });
    } catch (e) {
      logger.warn(`FIREBASE_SERVICE_ACCOUNT could not be base64-decoded: ${e.message}`);
    }
  }
  const adcPath = path.join(os.homedir(), '.config', 'gcloud', 'application_default_credentials.json');
  if (fs.existsSync(adcPath)) {
    candidates.push({ source: `ADC (${adcPath})`, value: adcPath });
  }

  for (const candidate of candidates) {
    try {
      if (candidate.source === 'FIREBASE_SERVICE_ACCOUNT') {
        admin.initializeApp({ credential: admin.credential.cert(JSON.parse(candidate.value)) });
        logger.info(`firebase-admin initialized from ${candidate.source}`);
        return admin;
      }
      if (!fs.existsSync(candidate.value)) {
        logger.warn(`Firebase credential path does not exist: ${candidate.source}`);
        continue;
      }
      const raw = fs.readFileSync(candidate.value, 'utf8');
      const parsed = JSON.parse(raw);
      if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
        logger.warn(`Firebase credential file is not a service-account JSON: ${candidate.source}`);
        continue;
      }
      admin.initializeApp({ credential: admin.credential.cert(parsed) });
      logger.info(`firebase-admin initialized from ${candidate.source}`);
      return admin;
    } catch (e) {
      logger.warn(`Failed to initialize firebase-admin from ${candidate.source}: ${e.message}`);
    }
  }

  logger.error(
    'firebase-admin is NOT initialized: no valid service-account credentials found. ' +
    'Set GOOGLE_APPLICATION_CREDENTIALS to your Firebase service-account JSON (or FIREBASE_SERVICE_ACCOUNT to its base64). ' +
    'All authenticated endpoints (/auth/me, /bookings/*, /business/*, ...) will reject tokens with 401.'
  );
  return admin;
}

module.exports = { initFirebase };