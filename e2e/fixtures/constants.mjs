// Shared e2e fixture constants — importable by specs and helpers. The
// database rows these describe are created by fixtures/fixtures.mjs.
export const SITE_HOST = "mysite.localhost";
export const SITE_CUSTOMER_EMAIL = "e2e.customer@mysite.test";
export const SITE_CUSTOMER_PASSWORD = "e2e-password-123";
export const SITE_CUSTOMER_NAME = "E2E Customer";
// Fixed plaintext session token — the DB stores its HMAC; specs inject the
// plaintext into localStorage as site_customer_token.
export const SITE_CUSTOMER_TOKEN = "e2e-site-customer-session-token-0001";

export const DEMO_OWNER = { uid: "demo-owner-uid", email: "owner@myslot.lk" };
export const DEMO_ADMIN = { uid: "demo-admin-uid", email: "admin@myslot.lk" };

export const SLUGS = {
  smashArena: "smash-arena",
  greenTurf: "green-turf-colombo",
  lankaCricket: "lanka-cricket-nets"
};