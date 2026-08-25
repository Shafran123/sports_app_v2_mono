const crypto = require('crypto');
const pool = require('../db');
const { initFirebase } = require('../config/firebase');
const businessService = require('./businesses');

// Creates the users row (role venue_owner) and the owner's Business in one
// self-contained step. A new account has no venues yet, so the Business name
// starts as the account name; the owner renames it on the Widget & site page.
async function insertOwnerUser({ firebaseUid, email, name, phone }) {
  const { rows } = await pool.query(
    `insert into users (firebase_uid, email, name, phone, role, status, onboarding_state, must_change_password)
     values ($1, $2, $3, $4, 'venue_owner', 'active', 'pending', true)
     returning *`,
    [firebaseUid, email, name || null, phone || null]
  );
  const user = rows[0];
  await businessService.ensureForOwner(user.id, name || 'My Business');
  return { user };
}

// Provisions a Venue Owner account (ADR-0022). In production this creates the
// Firebase user with the temporary password so the owner can sign in; in the
// test suite Firebase is not available, so the users row is created directly
// with a synthetic uid (the suite signs test JWTs for that uid).
async function createOwnerAccount({ name, email, phone, temporaryPassword }) {
  if (process.env.NODE_ENV === 'test') {
    const firebaseUid = crypto.randomUUID();
    return insertOwnerUser({ firebaseUid, email, name, phone });
  }

  initFirebase();
  const admin = require('firebase-admin');
  const record = await admin.auth().createUser({
    email,
    password: temporaryPassword,
    displayName: name || undefined
  });
  return insertOwnerUser({ firebaseUid: record.uid, email, name, phone });
}

module.exports = { createOwnerAccount };