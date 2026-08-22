const pool = require('../../db');

// Enable the feature flags that the pre-flags test suite assumed were on:
// the hard phone-verification gate and online payment. Defaults are OFF
// (SMSGo/PayHere not yet live), so suites exercising the legacy behavior
// explicitly flip them on at the start.
async function enableLegacyFlags() {
  await pool.query(
    `insert into platform_config (key, value, updated_at) values
       ('phone_verification_required', 'true'::jsonb, now()),
       ('payhere_enabled', 'true'::jsonb, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`
  );
}

// Reset all feature flags back to their registry defaults.
async function resetFlagsToDefaults() {
  await pool.query(
    `insert into platform_config (key, value, updated_at) values
       ('phone_verification_required', 'false'::jsonb, now()),
       ('sms_enabled', 'false'::jsonb, now()),
       ('payhere_enabled', 'false'::jsonb, now()),
       ('events_discovery_state', '"enabled"'::jsonb, now()),
       ('tax_rate', '0'::jsonb, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`
  );
}

// Turn on the SMS channel flag (OTP + transactional tests exercise the
// transport itself rather than the gate).
async function enableSms() {
  await pool.query(
    `insert into platform_config (key, value, updated_at) values ('sms_enabled', 'true'::jsonb, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`
  );
}

module.exports = { enableLegacyFlags, resetFlagsToDefaults, enableSms };