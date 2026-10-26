import { test, expect } from "@playwright/test";
import { PORTS, SITE_HOST } from "../playwright.config.ts";
import { injectSiteCustomerSession } from "../helpers/site-session.mjs";
import { query } from "../helpers/db.mjs";
import { SITE_CUSTOMER_EMAIL } from "../fixtures/constants.mjs";

// The site surface has no "my bookings" list (the marketplace bookings route
// is retired, ADR-0045) — a Site Customer reaches their bookings through the
// booking confirmation page (/bookings/[id]) reached after checkout. This
// spec covers that page for a seeded fixture booking. Cancellation of a site
// booking is covered owner-side (owner-console.spec.ts).
test.describe("site customer bookings management", () => {
  test("a signed-in site customer views their booking and QR", async ({ page }) => {
    await injectSiteCustomerSession(page);

    const { rows } = await query(
      `select b.id from bookings b
       join site_customers sc on sc.id = b.site_customer_id
       where sc.email = $1 and b.status = 'confirmed'
       order by b.created_at desc limit 1`,
      [SITE_CUSTOMER_EMAIL]
    );
    expect(rows[0]).toBeTruthy();

    await page.goto(`http://${SITE_HOST}:${PORTS.user}/bookings/${rows[0].id}`);

    await expect(page.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();
    await expect(page.getByText("Smash Arena").first()).toBeVisible();
    await expect(page.getByAltText("Booking check-in QR code")).toBeVisible();
  });
});