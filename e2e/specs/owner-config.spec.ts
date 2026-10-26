import { test, expect } from "@playwright/test";
import { PORTS } from "../playwright.config.ts";
import { injectPlatformToken } from "../helpers/tokens.mjs";
import { query } from "../helpers/db.mjs";
import { DEMO_OWNER, SITE_CUSTOMER_EMAIL, SITE_CUSTOMER_NAME } from "../fixtures/constants.mjs";

const ADMIN = `http://localhost:${PORTS.admin}`;

async function ownerPage(page) {
  await injectPlatformToken(page, DEMO_OWNER, String(PORTS.admin));
}

test.describe("owner venue & configuration", () => {
  test("booking settings toggles persist", async ({ page }) => {
    await ownerPage(page);
    await page.goto(`${ADMIN}/booking-settings`);
    await expect(page.getByRole("heading", { name: "Booking settings" })).toBeVisible();

    const toggle = page.getByRole("switch", { name: "Auto-confirm bookings" });
    await toggle.click();
    await page.getByRole("button", { name: "Save booking settings" }).click();

    await expect(page.getByText("Saved — applies to new bookings.")).toBeVisible();

    const { rows } = await query(
      `select auto_confirm from businesses b join users u on u.id = b.owner_id where u.firebase_uid = $1`,
      [DEMO_OWNER.uid]
    );
    expect(rows[0].auto_confirm).toBe(false);

    // Restore auto-confirm so later specs (site journey, quick book) keep
    // booking into the confirmed state — the suite must not depend on order.
    await toggle.click();
    await page.getByRole("button", { name: "Save booking settings" }).click();
    await expect(page.getByText("Saved — applies to new bookings.")).toBeVisible();
    const { rows: after } = await query(
      `select auto_confirm from businesses b join users u on u.id = b.owner_id where u.firebase_uid = $1`,
      [DEMO_OWNER.uid]
    );
    expect(after[0].auto_confirm).toBe(true);
  });

  test("pricing grid paints and saves a variable price", async ({ page }) => {
    await ownerPage(page);
    await page.goto(`${ADMIN}/venues`);
    await page.getByRole("link", { name: "Smash Arena" }).first().click();

    await page.getByRole("tab", { name: "Pricing" }).click();
    await expect(page.getByRole("heading", { name: "Variable pricing" }).first()).toBeVisible();

    await page.getByLabel("Price to paint").fill("2000");
    await page.locator('button[aria-label*="6:00 PM"]').first().click();
    await page.getByRole("button", { name: "Save pricing" }).click();

    await expect(page.getByText("What will be saved").first()).toBeVisible();

    const { rows } = await query(
      `select count(*)::int as n from court_pricing_rules
       where court_id in (select c.id from courts c join venues v on v.id = c.venue_id where v.name = 'Smash Arena')
       and price_per_slot = 2000`
    );
    expect(rows[0].n).toBeGreaterThan(0);
  });

  test("widget & site shows the embed key and saves a brand edit", async ({ page }) => {
    await ownerPage(page);
    await page.goto(`${ADMIN}/widget-and-site`);
    await expect(page.getByRole("heading", { name: "Widget & site" })).toBeVisible();

    const embedKey = page.locator('p:has-text("/embed/")').first();
    await expect(embedKey).toBeVisible();

    const tagline = page.getByPlaceholder("Book your court in seconds");
    await tagline.fill("E2E tagline — book your court");
    await page.getByRole("button", { name: "Save brand" }).click();
    await expect(page.getByText(/Brand saved/)).toBeVisible();
  });

  test("customers page lists the fixture site customer", async ({ page }) => {
    await ownerPage(page);
    await page.goto(`${ADMIN}/customers`);
    await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();

    await page.getByLabel("Search customers").fill(SITE_CUSTOMER_EMAIL);
    await expect(page.getByText(SITE_CUSTOMER_NAME).first()).toBeVisible();
    await expect(page.getByText(SITE_CUSTOMER_EMAIL).first()).toBeVisible();
  });
});