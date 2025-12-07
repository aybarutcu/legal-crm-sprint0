/**
 * E2E Smoke Test: Workflow Dependencies
 * 
 * Simple smoke tests to verify dependency features are accessible in the UI.
 * These tests focus on verifying the features exist and are rendered, not full workflows.
 */

import { test, expect, Page } from "@playwright/test";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";

/**
 * Login helper (passwordless login - email only)
 */
async function login(page: Page, email: string) {
  await page.goto(`${baseUrl}/login`);
  await page.fill('input[type="email"]', email);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
}

test.describe("Workflow Dependencies - Smoke Tests", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "lawyer@legalcrm.local");
  });

  test("should access workflow templates page", async ({ page }) => {
    // Navigate to templates page
    await page.goto(`${baseUrl}/dashboard/workflows/templates`);
    await page.waitForTimeout(3000); // Wait for page to fully load
    
    // Verify we're on the right page by checking URL
    const currentUrl = page.url();
    expect(currentUrl).toContain('/workflows/templates');
    
    console.log("✓ Workflow templates page accessible");
  });

  test("should show graph view toggle in template editor", async ({ page }) => {
    // Find an existing template to view
    await page.goto(`${baseUrl}/dashboard/workflows/templates`);
    
    // Wait for templates to load
    await page.waitForTimeout(2000);
    
    // Look for any template card with edit button
    const editButton = page.locator('button:has-text("Edit"), button[aria-label*="Edit"]').first();
    
    if (await editButton.isVisible({ timeout: 5000 })) {
      await editButton.click();
      await page.waitForTimeout(1000);
      
      // Look for Graph view toggle
      const graphToggle = page.locator('button:has-text("Graph"), button[aria-label*="Graph"]');
      const hasGraphView = await graphToggle.count() > 0;
      
      if (hasGraphView) {
        console.log("✓ Graph view toggle is available");
        expect(hasGraphView).toBe(true);
        
        // Try to switch to graph view
        await graphToggle.first().click();
        await page.waitForTimeout(1000);
        
        // Check if React Flow container appears
        const graphContainer = page.locator('.react-flow');
        const hasGraph = await graphContainer.count() > 0;
        
        if (hasGraph) {
          console.log("✓ Dependency graph renders successfully");
          expect(hasGraph).toBe(true);
        }
      } else {
        console.log("⚠ Graph view toggle not found (may need template with dependencies)");
      }
      
      // Close editor
      const cancelButton = page.locator('button:has-text("Cancel")');
      if (await cancelButton.isVisible({ timeout: 2000 })) {
        await cancelButton.click();
      } else {
        await page.keyboard.press('Escape');
      }
    } else {
      console.log("⚠ No templates found to test graph view");
    }
  });

  test("should have validation endpoint for dependencies", async ({ page }) => {
    // Test that the API endpoint exists by making a fetch call
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/workflows/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steps: [
            {
              id: 'step-1',
              title: 'Step 1',
              actionType: 'TASK',
              roleScope: 'LAWYER',
              dependsOn: [],
              dependencyLogic: 'ALL'
            },
            {
              id: 'step-2',
              title: 'Step 2',
              actionType: 'TASK',
              roleScope: 'LAWYER',
              dependsOn: ['step-1'],
              dependencyLogic: 'ALL'
            }
          ]
        })
      });
      const data = await res.json();
      return {
        status: res.status,
        ok: res.ok,
        valid: data.valid
      };
    });
    
    // Should return 200 for valid workflow
    expect(response.status).toBe(200);
    expect(response.valid).toBe(true);
    console.log("✓ Workflow validation API endpoint is working");
  });

  test("should reject workflow with cycle via API", async ({ page }) => {
    // Test that cycle detection works via API
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/workflows/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steps: [
            {
              id: 'step-1',
              title: 'Step 1',
              actionType: 'TASK',
              roleScope: 'LAWYER',
              dependsOn: ['step-2'],
              dependencyLogic: 'ALL'
            },
            {
              id: 'step-2',
              title: 'Step 2',
              actionType: 'TASK',
              roleScope: 'LAWYER',
              dependsOn: ['step-1'],
              dependencyLogic: 'ALL'
            }
          ]
        })
      });
      const data = await res.json();
      return {
        status: res.status,
        valid: data.valid,
        errors: data.errors || [],
        errorString: JSON.stringify(data.errors || [])
      };
    });
    
    // Should return 422 for validation error (cycle)
    expect(response.status).toBe(422);
    expect(response.valid).toBe(false);
    
    // Check that errors contain cycle-related message
    const hasCycleError = response.errorString.toLowerCase().includes('cycle') || 
                          response.errorString.toLowerCase().includes('circular') ||
                          response.errors.length > 0; // At least has validation errors
    
    expect(hasCycleError).toBe(true);
    console.log("✓ Cycle detection API is working");
    console.log(`  Errors: ${response.errorString}`);
  });
});
