// Site Customer sessions are opaque bearer tokens stored as HMACs — there is
// no mint path, so specs use the fixture-created session (constants.mjs) and
// inject its plaintext into localStorage (packages/auth persists it under
// site_customer_token). Must run on the site host: the API client only sends
// the site token when __SITE_HOST__ is set (packages/api client.ts).
import { SITE_HOST, SITE_CUSTOMER_TOKEN } from "../fixtures/constants.mjs";
import { PORTS } from "../playwright.config.ts";

export async function injectSiteCustomerSession(page) {
  await page.goto(`http://${SITE_HOST}:${PORTS.user}/`);
  await page.evaluate((token) => {
    window.localStorage.setItem("site_customer_token", token);
  }, SITE_CUSTOMER_TOKEN);
}