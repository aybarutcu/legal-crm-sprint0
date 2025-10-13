import { test, expect } from "@playwright/test";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";

async function loginWithEmail(page, email: string) {
  await page.goto(`${baseUrl}/login`);
  await page.fill('input[type="email"]', email);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/);
}

test("unauthorized user is redirected to home", async ({ page }) => {
  await page.goto(`${baseUrl}/dashboard`);
  const escapedBase = baseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await expect(page).toHaveURL(new RegExp(`^${escapedBase}\\/?$`));
});

test("user can login with email credential and access dashboard", async ({ page }) => {
  await loginWithEmail(page, "playwright-user@legalcrm.local");
  await expect(page.getByText("Legal CRM Dashboard")).toBeVisible();
  await expect(page.getByTestId("dashboard-overview")).toBeVisible();
  await expect(page.getByText("Yaklaşan Etkinlikler (7 gün)")).toBeVisible();
  await expect(page.getByText("Açık Görevler")).toBeVisible();
  await expect(page.getByText("Son Yüklenen Dokümanlar")).toBeVisible();
});

test("user can create a new contact and view detail", async ({ page }) => {
  await loginWithEmail(page, "admin@legalcrm.local");

  await page.goto(`${baseUrl}/contacts`);
  await page.click('[data-testid="new-contact-button"]');

  const unique = Date.now();
  const firstName = `Test${unique}`;
  const lastName = "Playwright";

  await page.fill('[data-testid="new-contact-firstName"]', firstName);
  await page.fill('[data-testid="new-contact-lastName"]', lastName);
  await page.fill('[data-testid="new-contact-email"]', `test-${unique}@example.com`);
  await page.click('[data-testid="new-contact-submit"]');

  await expect(page.getByRole("link", { name: firstName })).toBeVisible();
  await page.click(`text=${firstName}`);
  await expect(page).toHaveURL(/\/contacts\//);
  await expect(page.getByTestId("contact-detail")).toBeVisible();
  await expect(page.getByText(lastName)).toBeVisible();
});
