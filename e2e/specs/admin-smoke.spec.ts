import { test, expect } from "@playwright/test";
import { PORTS } from "../playwright.config.ts";
import { injectPlatformToken } from "../helpers/tokens.mjs";
import { DEMO_ADMIN } from "../fixtures/constants.mjs";

const ADMIN = `http://localhost:${PORTS.admin}`;

async function adminPage(page) {
  await injectPlatformToken(page, DEMO_ADMIN, String(PORTS.admin));
}

// Admin is P2: smoke coverage only — dashboard, approvals, settings flags.
test.describe("admin console smoke", () => {
  test("admin lands on the platform dashboard", async ({ page }) => {
    await adminPage(page);
    await page.goto(`${ADMIN}/`);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Platform overview")).toBeVisible();
  });

  test("venue approvals queue renders", async ({ page }) => {
    await adminPage(page);
    await page.goto(`${ADMIN}/approvals`);
    await expect(page.getByRole("heading", { name: "Venue approvals" })).toBeVisible();
  });

  test("settings renders the feature flags panel", async ({ page }) => {
    await adminPage(page);
    await page.goto(`${ADMIN}/settings`);
    await expect(page.getByRole("heading", { name: "Settings & reports" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Feature flags" })).toBeVisible();
  });
});