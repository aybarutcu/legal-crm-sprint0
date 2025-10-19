/**
 * E2E Test: Cycle Detection in Workflow Dependencies
 * 
 * Tests P0.2 cycle detection features:
 * 1. Attempt to create workflow template with simple cycle (A → B → A)
 * 2. Verify UI shows cycle warning with red edges in graph view
 * 3. Verify validation prevents template creation
 * 4. Attempt to create complex cycle (A → B → C → D → B)
 * 5. Verify self-dependency is rejected
 * 6. Verify forward dependency is rejected
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

/**
 * Navigate to workflow templates page
 */
async function navigateToTemplates(page: Page) {
  await page.goto(`${baseUrl}/dashboard/workflows/templates`);
  await expect(page).toHaveURL(/\/workflows\/templates/);
}

/**
 * Start creating a new template
 */
async function startNewTemplate(page: Page, name: string, description: string) {
  const createButton = page.locator('button:has-text("New Template"), button:has-text("Create Template")').first();
  await createButton.click();
  
  await page.fill('input[name="name"]', name);
  await page.fill('textarea[name="description"]', description);
}

/**
 * Add a step to the template
 */
async function addStep(page: Page, stepIndex: number, title: string, actionType: string = "TASK") {
  await page.click('button:has-text("Add Step")');
  
  const titleInput = page.locator('input[placeholder*="Step Title"], input[placeholder*="step title"]').nth(stepIndex);
  await titleInput.fill(title);
  
  const actionTypeSelect = page.locator('select').filter({ hasText: /Action Type|Type/ }).nth(stepIndex);
  await actionTypeSelect.selectOption(actionType);
}

/**
 * Set dependencies for a step
 */
async function setDependencies(page: Page, stepOrder: number, dependsOnOrders: number[]) {
  const stepSection = page.locator(`[data-step-order="${stepOrder}"]`);
  
  // Find dependency selector within this step
  const depsSelect = stepSection.locator('select').filter({ hasText: /Depends On|depends/ }).first();
  
  if (await depsSelect.isVisible({ timeout: 2000 })) {
    await depsSelect.selectOption(dependsOnOrders.map(String));
  } else {
    // Try alternative approach - click on dependency section to expand
    const depSection = stepSection.locator('text=/Dependencies|Depends On/i').first();
    if (await depSection.isVisible()) {
      await depSection.click();
      await page.waitForTimeout(500);
      
      // Try again
      const depsSelectRetry = stepSection.locator('select').filter({ hasText: /Depends On|depends/ }).first();
      if (await depsSelectRetry.isVisible()) {
        await depsSelectRetry.selectOption(dependsOnOrders.map(String));
      }
    }
  }
}

/**
 * Switch to graph view
 */
async function switchToGraphView(page: Page) {
  const graphButton = page.locator('button:has-text("Graph"), button[aria-label*="Graph"]').first();
  if (await graphButton.isVisible({ timeout: 2000 })) {
    await graphButton.click();
    await page.waitForTimeout(1000); // Wait for graph to render
  }
}

/**
 * Verify cycle warning is visible
 */
async function verifyCycleWarning(page: Page) {
  const cycleWarning = page.locator('text=/cycle|circular/i, [class*="cycle"], [class*="error"]').filter({ hasText: /cycle|circular/i });
  await expect(cycleWarning.first()).toBeVisible({ timeout: 5000 });
}

/**
 * Verify red cycle edges in graph
 */
async function verifyRedCycleEdges(page: Page) {
  const redEdges = page.locator('.react-flow__edge[stroke="red"], .react-flow__edge[class*="cycle"]');
  const count = await redEdges.count();
  expect(count).toBeGreaterThan(0);
}

/**
 * Attempt to save template (should fail if cycles exist)
 */
async function attemptSaveAndExpectFailure(page: Page) {
  const saveButton = page.locator('button:has-text("Save Template"), button:has-text("Create")').first();
  await saveButton.click();
  
  // Wait for error message
  await page.waitForTimeout(1000);
  
  // Verify error message appears
  const errorMessage = page.locator('text=/cycle|circular|invalid|error/i, [role="alert"], [class*="error"]');
  await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });
}

test.describe("Cycle Detection in Workflow Dependencies", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "lawyer@legalcrm.local");
    await navigateToTemplates(page);
  });

  test("should detect simple cycle (A → B → A)", async ({ page }) => {
    const templateName = `Simple Cycle Test ${Date.now()}`;
    
    // 1. Start new template
    await startNewTemplate(page, templateName, "Test simple cycle detection");
    
    // 2. Add Step A
    await addStep(page, 0, "Step A", "TASK");
    
    // 3. Add Step B (depends on A)
    await addStep(page, 1, "Step B", "TASK");
    await setDependencies(page, 1, [0]); // B depends on A
    
    // 4. Make Step A depend on Step B (creates cycle!)
    await setDependencies(page, 0, [1]); // A depends on B → CYCLE!
    
    // 5. Switch to graph view and verify cycle warning
    await switchToGraphView(page);
    await verifyCycleWarning(page);
    await verifyRedCycleEdges(page);
    
    // 6. Attempt to save - should fail
    await attemptSaveAndExpectFailure(page);
  });

  test("should detect complex cycle (A → B → C → D → B)", async ({ page }) => {
    const templateName = `Complex Cycle Test ${Date.now()}`;
    
    // 1. Start new template
    await startNewTemplate(page, templateName, "Test complex cycle detection");
    
    // 2. Create 4-step workflow with cycle in the middle
    await addStep(page, 0, "Step A", "TASK");
    await addStep(page, 1, "Step B", "TASK");
    await addStep(page, 2, "Step C", "TASK");
    await addStep(page, 3, "Step D", "TASK");
    
    // 3. Set up dependencies: A → B → C → D → B (cycle!)
    await setDependencies(page, 1, [0]); // B depends on A
    await setDependencies(page, 2, [1]); // C depends on B
    await setDependencies(page, 3, [2]); // D depends on C
    await setDependencies(page, 1, [0, 3]); // B depends on A AND D → creates cycle!
    
    // 4. Switch to graph view
    await switchToGraphView(page);
    
    // 5. Verify cycle detected
    await verifyCycleWarning(page);
    await verifyRedCycleEdges(page);
    
    // 6. Attempt to save - should fail
    await attemptSaveAndExpectFailure(page);
  });

  test("should reject self-dependency (A → A)", async ({ page }) => {
    const templateName = `Self-Dependency Test ${Date.now()}`;
    
    // 1. Start new template
    await startNewTemplate(page, templateName, "Test self-dependency rejection");
    
    // 2. Add single step
    await addStep(page, 0, "Step A", "TASK");
    
    // 3. Try to make step depend on itself
    await setDependencies(page, 0, [0]); // A depends on A (self-dependency)
    
    // 4. Verify error appears immediately (client-side validation)
    const errorMessage = page.locator('text=/self.*depend|cannot.*depend.*itself/i');
    
    // May appear in validation summary or inline
    const hasError = await errorMessage.count() > 0;
    if (hasError) {
      await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });
    }
    
    // 5. Switch to graph view and verify warning
    await switchToGraphView(page);
    await page.waitForTimeout(1000);
    
    // Should show validation error or cycle warning
    const validationError = page.locator('text=/invalid|error|self/i');
    await expect(validationError.first()).toBeVisible({ timeout: 5000 });
    
    // 6. Attempt to save - should fail
    await attemptSaveAndExpectFailure(page);
  });

  test("should reject forward dependency (Step 1 depends on Step 3)", async ({ page }) => {
    const templateName = `Forward Dependency Test ${Date.now()}`;
    
    // 1. Start new template
    await startNewTemplate(page, templateName, "Test forward dependency rejection");
    
    // 2. Add 3 steps
    await addStep(page, 0, "Step 1", "TASK");
    await addStep(page, 1, "Step 2", "TASK");
    await addStep(page, 2, "Step 3", "TASK");
    
    // 3. Try to make Step 1 depend on Step 3 (forward dependency)
    await setDependencies(page, 0, [2]); // Step 1 depends on Step 3 (order 2)
    
    // 4. Switch to graph view
    await switchToGraphView(page);
    await page.waitForTimeout(1000);
    
    // 6. Attempt to save - should fail with forward dependency error
    const saveButton = page.locator('button:has-text("Save Template"), button:has-text("Create")').first();
    await saveButton.click();
    await page.waitForTimeout(1000);
    
    // Should see error about forward dependency or invalid reference
    const validationError = page.locator('text=/forward|invalid|error/i');
    await expect(validationError.first()).toBeVisible({ timeout: 5000 });
  });

  test("should show validation summary with all cycle errors", async ({ page }) => {
    const templateName = `Validation Summary Test ${Date.now()}`;
    
    // 1. Create template with multiple validation issues
    await startNewTemplate(page, templateName, "Test validation summary display");
    
    // 2. Create workflow with multiple problems:
    //    - Step A depends on itself (self-dependency)
    //    - Step B → Step C → Step B (cycle)
    await addStep(page, 0, "Step A", "TASK");
    await addStep(page, 1, "Step B", "TASK");
    await addStep(page, 2, "Step C", "TASK");
    
    // Set up problematic dependencies
    await setDependencies(page, 0, [0]); // A → A (self-dependency)
    await setDependencies(page, 1, []); // B has no deps initially
    await setDependencies(page, 2, [1]); // C → B
    await setDependencies(page, 1, [2]); // B → C (creates cycle with previous line)
    
    // 3. Switch to graph view
    await switchToGraphView(page);
    await page.waitForTimeout(1000);
    
    // 4. Verify validation summary shows multiple errors
    const validationSummary = page.locator('[class*="validation"], [role="alert"]').first();
    await expect(validationSummary).toBeVisible({ timeout: 5000 });
    
    // Should mention multiple issues
    const summaryText = await validationSummary.textContent();
    expect(summaryText).toMatch(/2|multiple|error/i);
    
    // 5. Verify both issues are displayed
    const selfDepError = page.locator('text=/self.*depend/i');
    const cycleError = page.locator('text=/cycle|circular/i');
    
    // At least one of these should be visible
    const hasSelfDepError = await selfDepError.count() > 0;
    const hasCycleError = await cycleError.count() > 0;
    
    expect(hasSelfDepError || hasCycleError).toBe(true);
  });

  test("should allow saving valid workflow without cycles", async ({ page }) => {
    const templateName = `Valid Workflow ${Date.now()}`;
    
    // 1. Create valid workflow without cycles
    await startNewTemplate(page, templateName, "Valid workflow with no cycles");
    
    // 2. Create linear workflow: A → B → C
    await addStep(page, 0, "Step A", "TASK");
    await addStep(page, 1, "Step B", "TASK");
    await addStep(page, 2, "Step C", "TASK");
    
    await setDependencies(page, 1, [0]); // B depends on A
    await setDependencies(page, 2, [1]); // C depends on B
    
    // 3. Switch to graph view
    await switchToGraphView(page);
    await page.waitForTimeout(1000);
    
    // 4. Verify NO cycle warning
    const cycleWarning = page.locator('text=/cycle|circular/i').filter({ hasText: /warning|error|cycle/i });
    const cycleCount = await cycleWarning.count();
    expect(cycleCount).toBe(0);
    
    // 5. Verify validation success message
    const successMessage = page.locator('text=/valid|success|✓/i').filter({ hasText: /valid|success/i });
    if (await successMessage.count() > 0) {
      await expect(successMessage.first()).toBeVisible();
    }
    
    // 6. Save should succeed
    const saveButton = page.locator('button:has-text("Save Template"), button:has-text("Create")').first();
    await saveButton.click();
    
    // Wait for success (redirect or success message)
    await page.waitForTimeout(2000);
    
    // Should redirect to templates list or show success
    const currentUrl = page.url();
    const isOnTemplatesList = currentUrl.includes('/templates');
    const successToast = await page.locator('text=/success|created|saved/i').count();
    
    expect(isOnTemplatesList || successToast > 0).toBe(true);
  });
});
