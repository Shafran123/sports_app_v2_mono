const { jwtVerify } = require('jose');
const pool = require('../db');
const { fail } = require('../utils/response');
const logger = require('../utils/logger');
const { initFirebase } = require('../config/firebase');

async function verifyIdToken(token) {
  if (process.env.NODE_ENV === 'test') {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'test-secret');
    const { payload } = await jwtVerify(token, secret);
    return payload;
  }
  initFirebase();
  const admin = require('firebase-admin');
  return admin.auth().verifyIdToken(token);
}

// Creates the user row on first authenticated request, or refreshes it on later
// ones. `welcome: true` fires the signup welcome email only when the row is
// actually new (xmax = 0 on an upsert distinguishes insert from update).
// `phone` comes from the Firebase token's phone_number claim (Phone Sign-in);
// like email/name it only fills the row when the column is empty,
// so email/Google sign-ins never clobber an existing phone.
async function upsertUser(firebaseUid, email, name, { phone = null, welcome = false } = {}) {
  const { rows } = await pool.query(
    `insert into users (firebase_uid, email, name, phone)
     values ($1, $2, $3, $4)
     on conflict (firebase_uid)
     do update set
       email = coalesce(users.email, excluded.email),
       name = coalesce(users.name, excluded.name),
       phone = coalesce(users.phone, excluded.phone),
       updated_at = now()
     returning *, (xmax = 0) as inserted`,
    [firebaseUid, email || null, name || null, phone || null]
  );
  const user = rows[0];
  if (welcome && user.inserted && user.email) {
    const notificationCatalog = require('../utils/notificationCatalog');
    notificationCatalog.dispatch('signup.welcome', { user }).catch((err) => {
      logger.error(`Signup welcome email failed: ${err.message}`);
    });
  }
  return user;
}

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return fail(res, 401, 'UNAUTHORIZED', 'Access denied. No token provided.');
    }

    const token = authHeader.slice(7);
    const decoded = await verifyIdToken(token);

    const user = await upsertUser(decoded.uid, decoded.email, decoded.name, {
      phone: decoded.phone_number,
      welcome: true
    });
    req.user = user;

    // Admin-role callers are unaffected by player-level ban/suspension
    // (requireRole('admin') still gates the admin surfaces).
    if (user.role !== 'admin') {
      // Ban is permanent — the account's sign-in is revoked entirely.
      if (user.status === 'banned') {
        return fail(res, 403, 'ACCOUNT_BANNED', 'This account has been banned.');
      }
      // Suspension stops creating new bookings/registrations/holds; reads of
      // existing data stay allowed so confirmed bookings remain usable.
      if (user.is_suspended && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return fail(res, 403, 'ACCOUNT_SUSPENDED', 'This account has been suspended.');
      }
    }

    next();
  } catch (error) {
    logger.error(`Auth error: ${error.message}`);
    return fail(res, 401, 'UNAUTHORIZED', 'Invalid or expired token.');
  }
}

module.exports = { authenticate, upsertUser, verifyIdToken };
