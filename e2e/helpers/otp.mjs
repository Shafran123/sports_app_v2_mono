// Recovers a pending OTP code from the database. Codes are stored HMAC'd
// with OTP_HMAC_SECRET (never in plaintext) and sent by email/SMS that the
// harness never delivers, so the spec brute-forces the 6-digit code offline
// against the known secret (~1s for 10^6 HMACs).
import crypto from "node:crypto";
import { query } from "./db.mjs";

const E2E_OTP_HMAC_SECRET = process.env.E2E_OTP_HMAC_SECRET || "e2e-otp-secret";

export async function latestOtpCode({ email, channel }) {
  const { rows } = await query(
    `select o.code_hash, o.salt
     from site_customer_otps o
     join site_customers sc on sc.id = o.site_customer_id
     where sc.email = $1 and o.channel = $2
     order by o.created_at desc
     limit 1`,
    [email, channel]
  );
  if (!rows[0]) throw new Error(`no ${channel} OTP row for ${email}`);

  const { code_hash, salt } = rows[0];
  for (let i = 0; i < 1_000_000; i++) {
    const code = String(i).padStart(6, "0");
    const hash = crypto.createHmac("sha256", E2E_OTP_HMAC_SECRET).update(`${salt}${code}`).digest("hex");
    if (hash === code_hash) return code;
  }
  throw new Error(`OTP code for ${email}/${channel} not recoverable`);
}