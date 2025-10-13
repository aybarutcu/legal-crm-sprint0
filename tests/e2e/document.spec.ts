import { test, expect } from "@playwright/test";
import { Buffer } from "node:buffer";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";

async function login(page, email: string) {
  await page.goto(`${baseUrl}/login`);
  await page.fill('input[type="email"]', email);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Document flow", () => {
  test("upload, preview, and download document", async ({ page, context }) => {
    await login(page, "admin@legalcrm.local");

    await page.goto(`${baseUrl}/documents`);
    await expect(page.getByTestId("documents-page-client")).toBeVisible();

    await page.click('[data-testid="document-upload-button"]');

    const fileName = `test-document-${Date.now()}.pdf`;
    const pdfContent = Buffer.from(
      `%PDF-1.3\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Contents 4 0 R>>endobj\n4 0 obj<</Length 44>>stream\nBT /F1 24 Tf 72 120 Td (Legal CRM Test) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/Name/F1/BaseFont/Helvetica>>endobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000062 00000 n \n0000000122 00000 n \n0000000211 00000 n \n0000000324 00000 n \ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n390\n%%EOF\n`,
      "utf-8",
    );

    await page.setInputFiles('input[type="file"]', {
      name: fileName,
      mimeType: "application/pdf",
      buffer: pdfContent,
    });

    await page.click('button:has-text("Yükle")');

    await expect(page.locator('[data-testid="document-upload-dialog"]')).toHaveCount(0, {
      timeout: 20000,
    });

    await page.reload();

    await expect(page.locator("table")).toContainText(fileName, { timeout: 15000 });
    const row = page.locator("table tbody tr", { hasText: fileName }).first();
    await row.click();

    const drawer = page.locator("text=Doküman Detayı");
    await expect(drawer).toBeVisible();

    await page.waitForTimeout(1000);
    const iframe = page.locator("iframe");
    const image = page.locator("img");
    const preview = iframe.or(image);
    if (await preview.count()) {
      await expect(preview.first()).toBeVisible({ timeout: 15000 });
    }

    const openLink = page.getByRole("link", { name: "Yeni Sekmede Aç" });
    if (await openLink.count()) {
      await expect(openLink).toBeVisible();
    }

    const [downloadPage] = await Promise.all([
      context.waitForEvent("page"),
      page.click('button:has-text("İndir")'),
    ]);
    await expect(downloadPage).toHaveURL(/.+/);
    await downloadPage.close();

    await page.click('button:has-text("Kapat")');
    await expect(drawer).toBeHidden();
  });
});
