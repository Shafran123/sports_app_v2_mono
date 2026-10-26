import { test, expect } from "@playwright/test";
import { PORTS } from "../playwright.config.ts";
import { injectPlatformToken } from "../helpers/tokens.mjs";
import { query } from "../helpers/db.mjs";
import { DEMO_OWNER, SITE_CUSTOMER_EMAIL } from "../fixtures/constants.mjs";

const ADMIN = `http://localhost:${PORTS.admin}`;

// The Radix dialog scrolls internally, which breaks Playwright's native
// select clicking ("subtree intercepts pointer events"). Set the value
// directly and dispatch the change event the SelectSheet listens for.
async function setSelect(scope, id, index) {
  await scope.locator(`#${id}`).evaluate((el, idx) => {
    const select = el;
    const value = [...select.options][idx]?.value ?? "";
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return value;
  }, index);
}

async function ownerPage(page) {
  await injectPlatformToken(page, DEMO_OWNER, String(PORTS.admin));
  return page;
}

test.describe("owner console core", () => {
  test("owner lands on the dashboard", async ({ page }) => {
    await ownerPage(page);
    await page.goto(`${ADMIN}/`);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Your venues at a glance")).toBeVisible();
  });

  test("owner confirms a pending booking from the bookings detail page", async ({ page }) => {
    await ownerPage(page);

    const { rows } = await query(
      `select b.id from bookings b
       join site_customers sc on sc.id = b.site_customer_id
       where sc.email = $1 and b.status = 'pending'
       order by b.created_at desc limit 1`,
      [SITE_CUSTOMER_EMAIL]
    );
    expect(rows[0]).toBeTruthy();

    await page.goto(`${ADMIN}/bookings/${rows[0].id}`);
    await expect(page.getByRole("heading", { name: "Booking details" })).toBeVisible();
    await page.getByRole("button", { name: "Confirm booking" }).click();

    await expect(page.getByText("Confirmed").first()).toBeVisible();

    const { rows: after } = await query(`select status from bookings where id = $1`, [rows[0].id]);
    expect(after[0].status).toBe("confirmed");
  });

  test("owner checks in a confirmed booking at the front desk by pasting its code", async ({ page }) => {
    await ownerPage(page);

    const { rows } = await query(
      `select b.qr_token from bookings b
       join site_customers sc on sc.id = b.site_customer_id
       where sc.email = $1 and b.status = 'confirmed'
       order by b.created_at desc limit 1`,
      [SITE_CUSTOMER_EMAIL]
    );
    expect(rows[0]?.qr_token).toBeTruthy();

    await page.goto(`${ADMIN}/front-desk`);
    await expect(page.getByRole("heading", { name: "Front desk" })).toBeVisible();

    await page.getByRole("button", { name: "Scan QR" }).click();
    await page.getByPlaceholder("Or paste the booking code here").fill(rows[0].qr_token);
    await page.getByRole("button", { name: "Look up" }).click();

    await expect(page.getByText("E2E Customer").first()).toBeVisible();
    await page.getByRole("button", { name: "Check in" }).click();

    await expect(page.getByText("Completed").first()).toBeVisible();

    const { rows: after } = await query(`select status from bookings where qr_token = $1`, [rows[0].qr_token]);
    expect(after[0].status).toBe("completed");
  });

  test("owner quick-books a walk-in cash booking at the front desk", async ({ page }) => {
    await ownerPage(page);

    await page.goto(`${ADMIN}/front-desk`);
    await page.getByRole("button", { name: "Quick book" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Quick book" })).toBeVisible();

    const tomorrowLk = new Date(Date.now() + (5 * 60 + 30 + 24 * 60) * 60000).toISOString().slice(0, 10);
    await dialog.locator("#qb-date").fill(tomorrowLk);
    await setSelect(dialog, "qb-court", 1);
    await page.waitForTimeout(500);
    await setSelect(dialog, "qb-duration", 1);
    await page.waitForTimeout(500);

    const startTimes = dialog.locator('button:has-text("–")');
    await expect(startTimes.first()).toBeVisible();
    await startTimes.first().click();

    await dialog.locator("#qb-name").fill("E2E Walk-in");
    await setSelect(dialog, "qb-collection", 0);
    await dialog.getByRole("button", { name: "Confirm booking" }).click();

    // The dialog closes on success.
    await expect(dialog.getByRole("heading", { name: "Quick book" })).toBeHidden();

    const { rows } = await query(
      `select b.player_name, b.payment_method, b.status from bookings b
       where b.player_name = 'E2E Walk-in' order by b.created_at desc limit 1`
    );
    expect(rows[0]).toBeTruthy();
    expect(rows[0].payment_method).toBe("cash");
    expect(rows[0].status).toBe("confirmed");
  });
});