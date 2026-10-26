import { test, expect } from "@playwright/test";
import { PORTS, SITE_HOST } from "../playwright.config.ts";
import { SLUGS } from "../fixtures/constants.mjs";
import { injectPlatformToken } from "../helpers/tokens.mjs";

// Cold-start warm-up: Next dev compiles each route's client chunks lazily, and
// the first browser execution of a route can leave the page on the compile
// shell (hydration never completes). Visit each route once and wait for the
// REAL hydrated content, then re-visit to prove the route is stable. Run
// before every suite so the slow compile cost is never paid mid-assertion.
test.setTimeout(420_000);

async function warmAndVerify(page, url, ready) {
  await page.goto(url);
  await ready().first().waitFor({ state: "visible", timeout: 180_000 });
  // Re-visit: the second navigation is the one that is reliably stable.
  await page.goto(url);
  await ready().first().waitFor({ state: "visible", timeout: 60_000 });
}

test("warm the platform and site routes", async ({ page }) => {
  await warmAndVerify(page, `http://localhost:${PORTS.user}/`, () =>
    page.getByText(/Booking is moving to venue sites/i)
  );

  await warmAndVerify(page, `http://${SITE_HOST}:${PORTS.user}/`, () =>
    page.locator("section#venues")
  );

  await warmAndVerify(page, `http://${SITE_HOST}:${PORTS.user}/${SLUGS.smashArena}`, () =>
    page.getByRole("combobox", { name: "Pick a duration" })
  );

  await warmAndVerify(
    page,
    `http://${SITE_HOST}:${PORTS.user}/book/11111111-1111-1111-1111-111111111111`,
    () => page.getByRole("heading", { name: "Checkout" })
  );

  // Admin app routes (owner + admin consoles share this process). The
  // unauthenticated shell redirects to /login, so inject the owner token
  // before warming the authed routes.
  const adminBase = `http://localhost:${PORTS.admin}`;
  await warmAndVerify(page, `${adminBase}/login`, () => page.getByRole("button", { name: "Log in" }));

  await injectPlatformToken(page, { uid: "demo-owner-uid", email: "owner@myslot.lk" }, String(PORTS.admin));

  await warmAndVerify(page, `${adminBase}/`, () => page.getByRole("heading", { name: "Dashboard" }));
  await warmAndVerify(page, `${adminBase}/front-desk`, () => page.getByRole("heading", { name: "Front desk" }));
  await warmAndVerify(page, `${adminBase}/booking-settings`, () =>
    page.getByRole("heading", { name: "Booking settings" })
  );
  await warmAndVerify(page, `${adminBase}/venues`, () => page.getByRole("heading", { name: "My venues" }));
  await warmAndVerify(page, `${adminBase}/widget-and-site`, () =>
    page.getByRole("heading", { name: "Widget & site" })
  );
  await warmAndVerify(page, `${adminBase}/customers`, () => page.getByRole("heading", { name: "Customers" }));
});