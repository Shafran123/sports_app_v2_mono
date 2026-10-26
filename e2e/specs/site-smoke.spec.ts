import { test, expect } from "@playwright/test";
import { PORTS, SITE_HOST } from "../playwright.config.ts";

test("platform host shows the marketplace-closed slate", async ({ page }) => {
  await page.goto(`http://localhost:${PORTS.user}/`);
  await expect(page.getByText(/Booking is moving to venue sites/i)).toBeVisible();
});

test("dedicated site host renders the site home with the seeded venues", async ({ page }) => {
  await page.goto(`http://${SITE_HOST}:${PORTS.user}/`);
  const venuesSection = page.locator("section#venues");
  for (const venue of ["Smash Arena", "Green Turf Colombo", "Lanka Cricket Nets"]) {
    await expect(venuesSection.getByRole("link", { name: venue, exact: true })).toBeVisible();
  }
});

test("a venue page resolves on the dedicated site host", async ({ page }) => {
  await page.goto(`http://${SITE_HOST}:${PORTS.user}/smash-arena`);
  await expect(page.getByRole("heading", { name: /Smash Arena/i })).toBeVisible();
});