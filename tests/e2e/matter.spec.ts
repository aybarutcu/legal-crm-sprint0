import { test, expect } from "@playwright/test";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";

async function login(page, email: string) {
  await page.goto(`${baseUrl}/login`);
  await page.fill('input[type="email"]', email);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Matter flow", () => {
  test("create matter, see in list, update status", async ({ page }) => {
    await login(page, "admin@legalcrm.local");

    // Navigate to matters list
    await page.goto(`${baseUrl}/matters`);
    await expect(page.getByTestId("matters-page-client")).toBeVisible();

    // Open create dialog
    await page.click('[data-testid="new-matter-button"]');
    const title = `Test Davası ${Date.now()}`;
    await page.getByLabel("Başlık").fill(title);
    await page.selectOption('select[name="type"]', "CIVIL");

    const clientSelect = page.locator('select[name="clientId"]');
    const targetValue = await clientSelect.evaluate((select) => {
      const options = Array.from(select.options)
        .map((option) => option.value)
        .filter((value) => value.length > 0);
      return options[0] ?? "";
    });
    await clientSelect.selectOption(targetValue);
    await page.click('[data-testid="new-matter-submit"]');

    // Expect toast
    await expect(page.locator("text=/dava olarak eklendi./i")).toBeVisible();

    // Ensure list shows new record (refresh handled by toast)
    await expect(page.locator("table").first()).toContainText(title);

    // Go to detail page
    const firstMatter = page.locator('table tbody tr').first();
    const matterTitle = await firstMatter.locator('td').first().innerText();
    await firstMatter.locator('a').first().click();

    await expect(page.getByTestId("matter-detail-client")).toBeVisible();
    await expect(page.locator("h2")).toContainText(matterTitle);

    // Update status
    await page.getByLabel("Durum").selectOption("IN_PROGRESS");
    await page.click('button:has-text("Kaydet")');
    await expect(page.locator("text=Dava bilgileri güncellendi.")).toBeVisible();
  });
});
