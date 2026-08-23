const crypto = require('crypto');
const pool = require('../db');
const { initFirebase } = require('../config/firebase');

// Provisions a Venue Owner account (ADR-0022). In production this creates the
// Firebase user with the temporary password so the owner can sign in; in the
// test suite Firebase is not available, so the users row is created directly
// with a synthetic uid (the suite signs test JWTs for that uid).
async function createOwnerAccount({ name, email, phone, temporaryPassword }) {
  if (process.env.NODE_ENV === 'test') {
    const firebaseUid = crypto.randomUUID();
    const { rows } = await pool.query(
      `insert into users (firebase_uid, email, name, phone, role, status, onboarding_state, must_change_password)
       values ($1, $2, $3, $4, 'venue_owner', 'active', 'pending', true)
       returning *`,
      [firebaseUid, email, name || null, phone || null]
    );
    return { user: rows[0] };
  }

  initFirebase();
  const admin = require('firebase-admin');
  const record = await admin.auth().createUser({
    email,
    password: temporaryPassword,
    displayName: name || undefined
  });
  const { rows } = await pool.query(
    `insert into users (firebase_uid, email, name, phone, role, status, onboarding_state, must_change_password)
     values ($1, $2, $3, $4, 'venue_owner', 'active', 'pending', true)
     returning *`,
    [record.uid, email, name || null, phone || null]
  );
  return { user: rows[0] };
}

module.exports = { createOwnerAccount };