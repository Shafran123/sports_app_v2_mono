// E2E fixtures on top of the seeded demo data. Everything resolves from the
// seed, never from hardcoded ids: the Demo Business is the business owned by
// the demo owner user (firebase_uid demo-owner-uid), named after its oldest
// venue in a fresh database.
import crypto from "node:crypto";
import pg from "pg";
import { SITE_HOST, SITE_CUSTOMER_EMAIL, SITE_CUSTOMER_PASSWORD, SITE_CUSTOMER_NAME, SITE_CUSTOMER_TOKEN } from "./constants.mjs";

const OTP_HMAC_SECRET = process.env.OTP_HMAC_SECRET || "e2e-otp-secret";

function hmacSha256(value) {
  return crypto.createHmac("sha256", OTP_HMAC_SECRET).update(value).digest("hex");
}

// Must match siteCustomers.js hashPassword: scrypt with Node defaults
// (N=16384, r=8, p=1), 64-byte key, formatted scrypt$N$R$P$salt$hash.
function scryptHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64);
  return `scrypt$16384$8$1$${salt}$${hash.toString("hex")}`;
}

async function applyFixtures() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL env var is required");

  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const { rows: businessRows } = await pool.query(
      `select b.id from businesses b
       join users u on u.id = b.owner_id
       where u.firebase_uid = $1`,
      ["demo-owner-uid"]
    );
    const businessId = businessRows[0]?.id;
    if (!businessId) throw new Error("Demo Business not found in seed");

    await pool.query(
      `insert into site_domain_requests (business_id, hostname, hostname_kind, status, dns_type, dns_value, live_at)
       values ($1, $2, 'custom', 'live', 'TXT', 'myslot-site-verification=e2e', now())
       on conflict (business_id) do update set
         hostname = excluded.hostname, status = 'live', live_at = now(), updated_at = now()`,
      [businessId, SITE_HOST]
    );

    await pool.query(
      `insert into business_payment_methods (business_id, method, enabled) values
         ($1, 'cash', true),
         ($1, 'payhere', false)
       on conflict (business_id, method) do update set enabled = excluded.enabled, updated_at = now()`,
      [businessId]
    );

    // The demo owner's onboarding must be accepted so the console never
    // bounces them to the plan page.
    await pool.query(
      `update users set onboarding_state = 'accepted'
       where firebase_uid = 'demo-owner-uid'`
    );

    const { rows: customerRows } = await pool.query(
      `insert into site_customers (business_id, email, name, phone, password_hash, email_verified_at, phone_verified_at)
       values ($1, $2, $3, '+94700000000', $4, now(), now())
       returning id`,
      [businessId, SITE_CUSTOMER_EMAIL, SITE_CUSTOMER_NAME, scryptHash(SITE_CUSTOMER_PASSWORD)]
    );
    const customerId = customerRows[0].id;

    await pool.query(
      `insert into site_customer_sessions (site_customer_id, token_hash, expires_at)
       values ($1, $2, now() + interval '30 days')`,
      [customerId, hmacSha256(SITE_CUSTOMER_TOKEN)]
    );

    // Two fixture bookings for the site customer (tomorrow, LK 14:00 and
    // 16:00, on Smash Arena's first court): one pending for the owner to
    // confirm in the console, one confirmed for front-desk check-in. Slots
    // stay within the seeded 06:00–23:00 LK windows and never overlap the
    // journey spec's picks (the journey always takes the earliest future
    // slot, 06:00 LK, or today's slots).
    const { rows: courtRows } = await pool.query(
      `select c.id from courts c join venues v on v.id = c.venue_id
       where v.slug = 'smash-arena' and c.is_active
       order by c.name limit 1`
    );
    const courtId = courtRows[0]?.id;
    if (!courtId) throw new Error("Smash Arena court not found in seed");

    const pendingStart = `date_trunc('day', now()) + interval '1 day 8 hours 30 minutes'`;
    const confirmedStart = `date_trunc('day', now()) + interval '1 day 10 hours 30 minutes'`;
    await pool.query(
      `insert into bookings
         (court_id, site_customer_id, start_at, end_at, price_per_slot, total_price,
          subtotal_amount, discount_amount, status, payment_method, player_name,
          player_phone, qr_token, site_hostname, tax_rate, tax_amount,
          venue_tax_rate, venue_tax_amount, confirmed_at)
       values
         ($1, $2, ${pendingStart}, ${pendingStart} + interval '1 hour', 1500, 1500, 1500, 0,
          'pending', 'cash', $3, '+94700000000', $4, $5, 0, 0, 0, 0, null),
         ($1, $2, ${confirmedStart}, ${confirmedStart} + interval '1 hour', 1500, 1500, 1500, 0,
          'confirmed', 'cash', $3, '+94700000000', $6, $5, 0, 0, 0, 0, now())`,
      [courtId, customerId, SITE_CUSTOMER_NAME, crypto.randomBytes(16).toString("hex"), SITE_HOST, crypto.randomBytes(16).toString("hex")]
    );

    console.log(`[e2e] fixtures applied: live site ${SITE_HOST}, site customer ${SITE_CUSTOMER_EMAIL}, bookings seeded`);
  } finally {
    await pool.end();
  }
}

applyFixtures().catch((err) => {
  console.error("Fixture error:", err.message);
  process.exit(1);
});