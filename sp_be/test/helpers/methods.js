const pool = require('../../db');

// ADR-0044: payment methods are per Business, not per venue. Tests that used
// per-venue accepts_cash now enable the owner's Business payment methods.
// Businesses created via SQL directly (some suites bypass the service) may
// lack rows entirely — the helpers upsert them.

// Ensure both method rows exist for the owner's business (if any), then
// return the business_id (or null when the owner has no business).
async function businessIdFor(ownerUid) {
  const { rows } = await pool.query(
    `select b.id from businesses b join users u on u.id = b.owner_id
     where u.firebase_uid = $1`,
    [ownerUid]
  );
  const businessId = rows.length ? rows[0].id : null;
  if (businessId) {
    await pool.query(
      `insert into business_payment_methods (business_id, method, enabled) values
         ($1, 'cash', false),
         ($1, 'payhere', false)
       on conflict (business_id, method) do nothing`,
      [businessId]
    );
  }
  return businessId;
}

// Cash: a plain enabled flag.
async function enableBusinessCash(ownerUid, enabled = true) {
  await businessIdFor(ownerUid);
  await pool.query(
    `update business_payment_methods m set enabled = $3, updated_at = now()
     from businesses b, users u
     where m.business_id = b.id and b.owner_id = u.id and u.firebase_uid = $1 and m.method = $2`,
    [ownerUid, 'cash', enabled]
  );
}

// PayHere: enabled + configured (the checkout gate requires credentials).
// The secrets live in Secret Manager in production (ADR-0047); tests have no
// Secret Manager, so resolution falls back to the platform env keys and the
// row only carries the non-secret merchant/app IDs.
async function enableBusinessPayhere(ownerUid, enabled = true) {
  await businessIdFor(ownerUid);
  await pool.query(
    `update business_payment_methods m set
       enabled = $2,
       merchant_id = coalesce(m.merchant_id, 'TEST_MERCHANT_ID'),
       app_id = coalesce(m.app_id, 'TEST_APP_ID'),
       updated_at = now()
     from businesses b, users u
     where m.business_id = b.id and b.owner_id = u.id and u.firebase_uid = $1 and m.method = 'payhere'`,
    [ownerUid, enabled]
  );
}

// Direct row mutation for a specific business id (suites that create the
// business via SQL and know its id).
async function setBusinessMethodById(businessId, method, enabled = true) {
  await pool.query(
    `insert into business_payment_methods (business_id, method, enabled) values ($1, $2, $3)
     on conflict (business_id, method) do update set enabled = excluded.enabled, updated_at = now()`,
    [businessId, method, enabled]
  );
}

// Toggle a method row for an owner's business (upserts rows if missing).
async function setBusinessMethod(ownerUid, method, enabled = true) {
  await businessIdFor(ownerUid);
  await pool.query(
    `update business_payment_methods m set enabled = $3, updated_at = now()
     from businesses b, users u
     where m.business_id = b.id and b.owner_id = u.id and u.firebase_uid = $1 and m.method = $2`,
    [ownerUid, method, enabled]
  );
}

module.exports = { enableBusinessCash, enableBusinessPayhere, setBusinessMethod, setBusinessMethodById };