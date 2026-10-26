import { test, expect } from "@playwright/test";
import { PORTS, SITE_HOST } from "../playwright.config.ts";
import { latestOtpCode } from "../helpers/otp.mjs";
import { query } from "../helpers/db.mjs";
import { SLUGS } from "../fixtures/constants.mjs";

const JOURNEY_PASSWORD = "e2e-journey-pass-123";

function journeyEmail() {
  return `e2e.journey.${Date.now()}@mysite.test`;
}

function pickDateKey() {
  // Venues run on Colombo wall time (UTC+5:30); the harness machine may be on
  // any offset. Flip to tomorrow once Colombo's clock passes 21:00 so at
  // least one night slot remains.
  const colomboMin = Math.floor(Date.now() / 60000) + (5 * 60 + 30);
  const d = new Date();
  if ((colomboMin % 1440) >= 21 * 60) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Availability marks a slot as past only once its END has passed, but the
// server rejects a booking whose START is in the past (compared against the
// server's own clock). Pick the first enabled slot whose absolute start is at
// least 30 minutes away — immune to the harness machine's timezone. `dateKey`
// is the date selected in the picker (Colombo wall date).
async function pickFutureSlot(page, dateKey) {
  const buttons = page.locator('#book-a-slot button[aria-pressed="false"]:not([disabled])');
  const count = await buttons.count();
  const nowMin = Math.floor(Date.now() / 60000);
  const dayUtcMin = Math.floor(new Date(`${dateKey}T00:00:00Z`).getTime() / 60000);
  for (let i = 0; i < count; i++) {
    const label = (await buttons.nth(i).getAttribute("aria-label")) ?? "";
    const match = label.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) continue;
    let h = Number(match[1]) % 12;
    if (/PM/i.test(match[3])) h += 12;
    // Label is Colombo wall time; convert to absolute UTC minutes.
    const startUtcMin = dayUtcMin + h * 60 + Number(match[2]) - (5 * 60 + 30);
    if (startUtcMin > nowMin + 30) return buttons.nth(i);
  }
  throw new Error(`no future slot found among ${count} enabled slots`);
}

test.describe("site customer booking journey", () => {
  test("guest books a court on the dedicated site with a real sign-up", async ({ page }) => {
    const email = journeyEmail();
    const dateKey = pickDateKey();

    await page.goto(`http://${SITE_HOST}:${PORTS.user}/${SLUGS.smashArena}`);

    await expect(page.getByRole("heading", { name: /Smash Arena/i }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Book a slot" })).toBeVisible();

    await page.getByLabel("Pick a date").fill(dateKey);
    await page.getByRole("combobox", { name: "Pick a duration" }).selectOption({ index: 1 });

    const slot = await pickFutureSlot(page, dateKey);
    await expect(slot).toBeEnabled();
    await slot.click();

    await expect(page.getByRole("button", { name: "Sign in / Sign up to book" })).toBeVisible();

    await page.getByRole("button", { name: "Sign in / Sign up to book" }).click();
    await expect(page.getByRole("heading", { name: "Sign in to book" })).toBeVisible();

    await page.getByRole("button", { name: "Create an account" }).click();

    await page.getByPlaceholder("Your name").fill("E2E Journey Customer");
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("Password (6+ characters)").fill(JOURNEY_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Verified phone")).toBeVisible();

    const phoneCard = page.locator("div.rounded-2xl").filter({ hasText: "Verified phone" });
    await phoneCard.getByPlaceholder("077 123 4567").fill("+94771234567");
    await phoneCard.getByRole("button", { name: "Send code" }).click();
    const phoneCode = await latestOtpCode({ email, channel: "phone" });
    await phoneCard.getByPlaceholder("6-digit code").fill(phoneCode);
    await phoneCard.getByRole("button", { name: "Verify" }).last().click();
    await expect(phoneCard.getByText("Verified", { exact: true })).toBeVisible();

    const emailCard = page.locator("div.rounded-2xl").filter({ hasText: "Verified email" });
    await emailCard.getByPlaceholder("you@example.com").fill(email);
    await emailCard.getByRole("button", { name: "Send code" }).click();
    const emailCode = await latestOtpCode({ email, channel: "email" });
    await emailCard.getByPlaceholder("6-digit code").fill(emailCode);
    await emailCard.getByRole("button", { name: "Verify" }).last().click();

    // A fully verified customer auto-advances to the checkout page.
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("radio", { name: /Pay at venue/ })).toHaveAttribute("aria-checked", "true");

    await page.getByRole("button", { name: "Confirm booking" }).click();

    await expect(page.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();
    await expect(page.getByText("Pay on arrival")).toBeVisible();

    await page.getByRole("button", { name: "View booking & QR code" }).click();

    await expect(page.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();
    await expect(page.getByAltText("Booking check-in QR code")).toBeVisible();

    const { rows } = await query(
      `select b.id, b.status, b.payment_method, b.site_hostname, sc.email
       from bookings b
       join site_customers sc on sc.id = b.site_customer_id
       where sc.email = $1
       order by b.created_at desc
       limit 1`,
      [email]
    );
    expect(rows[0]).toBeTruthy();
    expect(rows[0].status).toBe("confirmed");
    expect(rows[0].payment_method).toBe("cash");
    expect(rows[0].site_hostname).toBe(SITE_HOST);
  });
});