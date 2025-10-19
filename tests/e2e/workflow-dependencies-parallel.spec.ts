/**
 * E2E Test: Parallel Workflow Execution (Fork Pattern)
 * 
 * Tests P0.2 dependency features with parallel execution:
 * 1. Create workflow template with fork pattern:
 *    - Step 1: Initial task (no dependencies)
 *    - Steps 2, 3, 4: Parallel tasks (all depend on Step 1)
 *    - Step 5: Final task (depends on ALL of 2, 3, 4)
 * 2. Instantiate workflow to a matter
 * 3. Verify Step 1 is READY, Steps 2-5 are PENDING
 * 4. Complete Step 1
 * 5. Verify Steps 2, 3, 4 all become READY (parallel execution)
 * 6. Complete Steps 2, 3, 4 in random order
 * 7. Verify Step 5 only becomes READY after ALL parallel steps complete
 * 8. Complete Step 5
 * 9. Verify workflow completes successfully
 */

import { test, expect, Page } from "@playwright/test";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";

// Test data
const TEMPLATE_NAME = `Parallel Workflow ${Date.now()}`;
const TEMPLATE_DESC = "Test parallel execution with fork-join pattern";

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
 * Create a 5-step fork-join workflow template via UI
 * Pattern:
 *       [1]
 *      / | \
 *    [2][3][4]  (parallel)
 *      \ | /
 *       [5]
 */
async function createForkJoinTemplate(page: Page) {
  // Click "New Template" or "Create Template" button
  const createButton = page.locator('button:has-text("New Template"), button:has-text("Create Template")').first();
  await createButton.click();
  
  // Fill template details
  await page.fill('input[name="name"]', TEMPLATE_NAME);
  await page.fill('textarea[name="description"]', TEMPLATE_DESC);
  
  // === Step 1: Initial Task (no dependencies) ===
  await page.click('button:has-text("Add Step")');
  
  const step1Title = page.locator('input[placeholder*="Step Title"], input[placeholder*="step title"]').first();
  await step1Title.fill("Initial Review");
  
  const step1ActionType = page.locator('select').filter({ hasText: /Action Type|Type/ }).first();
  await step1ActionType.selectOption("TASK");
  
  // No dependencies for Step 1
  
  // === Step 2: Parallel Task A (depends on Step 1) ===
  await page.click('button:has-text("Add Step")');
  
  const step2Title = page.locator('input[placeholder*="Step Title"], input[placeholder*="step title"]').nth(1);
  await step2Title.fill("Parallel Task A");
  
  const step2ActionType = page.locator('select').filter({ hasText: /Action Type|Type/ }).nth(1);
  await step2ActionType.selectOption("TASK");
  
  // Set dependency on Step 1 (order 0)
  // Find the dependency selector for Step 2 and select Step 1
  const step2DependencySection = page.locator('[data-step-order="1"]').locator('text=Dependencies').first();
  if (await step2DependencySection.isVisible()) {
    await step2DependencySection.click();
  }
  
  // Select Step 1 from dependency multi-select
  const step2DepsSelect = page.locator('[data-step-order="1"]').locator('select').filter({ hasText: /Depends On|depends/ }).first();
  if (await step2DepsSelect.isVisible()) {
    await step2DepsSelect.selectOption(["0"]); // Step 1 has order 0
  }
  
  // === Step 3: Parallel Task B (depends on Step 1) ===
  await page.click('button:has-text("Add Step")');
  
  const step3Title = page.locator('input[placeholder*="Step Title"], input[placeholder*="step title"]').nth(2);
  await step3Title.fill("Parallel Task B");
  
  const step3ActionType = page.locator('select').filter({ hasText: /Action Type|Type/ }).nth(2);
  await step3ActionType.selectOption("TASK");
  
  // Set dependency on Step 1
  const step3DepsSelect = page.locator('[data-step-order="2"]').locator('select').filter({ hasText: /Depends On|depends/ }).first();
  if (await step3DepsSelect.isVisible()) {
    await step3DepsSelect.selectOption(["0"]);
  }
  
  // === Step 4: Parallel Task C (depends on Step 1) ===
  await page.click('button:has-text("Add Step")');
  
  const step4Title = page.locator('input[placeholder*="Step Title"], input[placeholder*="step title"]').nth(3);
  await step4Title.fill("Parallel Task C");
  
  const step4ActionType = page.locator('select').filter({ hasText: /Action Type|Type/ }).nth(3);
  await step4ActionType.selectOption("TASK");
  
  // Set dependency on Step 1
  const step4DepsSelect = page.locator('[data-step-order="3"]').locator('select').filter({ hasText: /Depends On|depends/ }).first();
  if (await step4DepsSelect.isVisible()) {
    await step4DepsSelect.selectOption(["0"]);
  }
  
  // === Step 5: Final Task (depends on Steps 2, 3, 4 with ALL logic) ===
  await page.click('button:has-text("Add Step")');
  
  const step5Title = page.locator('input[placeholder*="Step Title"], input[placeholder*="step title"]').nth(4);
  await step5Title.fill("Final Review");
  
  const step5ActionType = page.locator('select').filter({ hasText: /Action Type|Type/ }).nth(4);
  await step5ActionType.selectOption("TASK");
  
  // Set dependencies on Steps 2, 3, 4 (orders 1, 2, 3)
  const step5DepsSelect = page.locator('[data-step-order="4"]').locator('select').filter({ hasText: /Depends On|depends/ }).first();
  if (await step5DepsSelect.isVisible()) {
    await step5DepsSelect.selectOption(["1", "2", "3"]);
  }
  
  // Set dependency logic to ALL (default, but verify)
  const step5LogicSelect = page.locator('[data-step-order="4"]').locator('select').filter({ hasText: /Dependency Logic|Logic/ }).first();
  if (await step5LogicSelect.isVisible()) {
    await step5LogicSelect.selectOption("ALL");
  }
  
  // Save template
  await page.click('button:has-text("Save Template"), button:has-text("Create")');
  
  // Wait for success message or redirect
  await page.waitForTimeout(2000); // Give time for save
}

/**
 * View dependency graph and verify structure
 */
async function verifyDependencyGraph(page: Page) {
  // Switch to Graph view
  const graphViewButton = page.locator('button:has-text("Graph"), button[aria-label*="Graph"]').first();
  if (await graphViewButton.isVisible()) {
    await graphViewButton.click();
    await page.waitForTimeout(1000); // Wait for graph to render
    
    // Verify graph is visible
    const graphContainer = page.locator('.react-flow');
    await expect(graphContainer).toBeVisible();
    
    // Verify 5 nodes exist
    const nodes = page.locator('.react-flow__node');
    await expect(nodes).toHaveCount(5);
    
    // Verify no cycle warning
    const cycleWarning = page.locator('text=/cycle|circular/i');
    await expect(cycleWarning).not.toBeVisible();
    
    // Switch back to Form view
    const formViewButton = page.locator('button:has-text("Form")').first();
    if (await formViewButton.isVisible()) {
      await formViewButton.click();
    }
  }
}

/**
 * Find a matter to attach workflow to
 */
async function findMatter(page: Page): Promise<string> {
  await page.goto(`${baseUrl}/dashboard/matters`);
  await page.waitForTimeout(1000);
  
  // Get first matter ID from the list
  const matterLink = page.locator('a[href*="/matters/"]').first();
  const href = await matterLink.getAttribute('href');
  
  if (!href) {
    throw new Error("No matter found to attach workflow to");
  }
  
  const matterId = href.split('/').pop() || '';
  return matterId;
}

/**
 * Attach workflow to matter
 */
async function attachWorkflowToMatter(page: Page, matterId: string, templateName: string): Promise<string> {
  await page.goto(`${baseUrl}/dashboard/matters/${matterId}`);
  
  // Click "Add Workflow" or "Attach Workflow"
  const attachButton = page.locator('button:has-text("Add Workflow"), button:has-text("Attach Workflow")').first();
  await attachButton.click();
  
  // Select the template from dropdown/list
  const templateSelect = page.locator(`select, [role="combobox"]`).filter({ hasText: new RegExp(templateName, 'i') }).first();
  if (await templateSelect.isVisible()) {
    await templateSelect.selectOption({ label: templateName });
  } else {
    // Try clicking on the template in a list
    await page.click(`text="${templateName}"`);
  }
  
  // Click "Attach" or "Create"
  await page.click('button:has-text("Attach"), button:has-text("Create Instance")');
  
  // Wait for workflow instance to be created
  await page.waitForTimeout(2000);
  
  // Get workflow instance ID from URL or DOM
  const workflowSection = page.locator('[data-testid*="workflow"], .workflow-instance').first();
  const instanceId = await workflowSection.getAttribute('data-instance-id') || '';
  
  return instanceId;
}

/**
 * Verify step states
 */
async function verifyStepStates(page: Page, expectedStates: Record<string, string>) {
  for (const [stepTitle, expectedState] of Object.entries(expectedStates)) {
    const stepCard = page.locator(`text="${stepTitle}"`).locator('..').locator('..');
    const stateBadge = stepCard.locator(`text=/${expectedState}/i`).first();
    await expect(stateBadge).toBeVisible({ timeout: 5000 });
  }
}

/**
 * Complete a workflow step
 */
async function completeStep(page: Page, stepTitle: string) {
  const stepCard = page.locator(`text="${stepTitle}"`).locator('..').locator('..');
  
  // Click "Start" if step is READY
  const startButton = stepCard.locator('button:has-text("Start")').first();
  if (await startButton.isVisible({ timeout: 1000 })) {
    await startButton.click();
    await page.waitForTimeout(500);
  }
  
  // Click "Complete"
  const completeButton = stepCard.locator('button:has-text("Complete")').first();
  await completeButton.click();
  await page.waitForTimeout(1000);
}

test.describe("Parallel Workflow Execution", () => {
  test.beforeEach(async ({ page }) => {
    // Login as lawyer
    await login(page, "lawyer@legalcrm.local");
  });

  test("should execute fork-join workflow with parallel steps", async ({ page }) => {
    // 1. Create fork-join template
    await navigateToTemplates(page);
    await createForkJoinTemplate(page);
    
    // 2. Verify dependency graph (if graph view is available)
    await verifyDependencyGraph(page);
    
    // 3. Find a matter and attach workflow
    const matterId = await findMatter(page);
    await attachWorkflowToMatter(page, matterId, TEMPLATE_NAME);
    
    // 4. Navigate to workflow instance detail page
    await page.goto(`${baseUrl}/dashboard/matters/${matterId}`);
    await page.waitForTimeout(1000);
    
    // 5. Verify initial state: Step 1 READY, Steps 2-5 PENDING
    await verifyStepStates(page, {
      "Initial Review": "READY",
      "Parallel Task A": "PENDING",
      "Parallel Task B": "PENDING",
      "Parallel Task C": "PENDING",
      "Final Review": "PENDING"
    });
    
    // 6. Complete Step 1
    await completeStep(page, "Initial Review");
    
    // 7. Verify Steps 2, 3, 4 all become READY (parallel execution!)
    await verifyStepStates(page, {
      "Initial Review": "COMPLETED",
      "Parallel Task A": "READY",
      "Parallel Task B": "READY",
      "Parallel Task C": "READY",
      "Final Review": "PENDING" // Still waiting for all parallel steps
    });
    
    // 8. Complete Step 2
    await completeStep(page, "Parallel Task A");
    
    // Verify Step 5 still PENDING (needs ALL steps)
    await verifyStepStates(page, {
      "Parallel Task A": "COMPLETED",
      "Parallel Task B": "READY",
      "Parallel Task C": "READY",
      "Final Review": "PENDING"
    });
    
    // 9. Complete Step 3
    await completeStep(page, "Parallel Task B");
    
    // Verify Step 5 still PENDING
    await verifyStepStates(page, {
      "Parallel Task B": "COMPLETED",
      "Parallel Task C": "READY",
      "Final Review": "PENDING"
    });
    
    // 10. Complete Step 4 (last parallel step)
    await completeStep(page, "Parallel Task C");
    
    // 11. Verify Step 5 becomes READY (ALL dependencies satisfied)
    await verifyStepStates(page, {
      "Parallel Task A": "COMPLETED",
      "Parallel Task B": "COMPLETED",
      "Parallel Task C": "COMPLETED",
      "Final Review": "READY"
    });
    
    // 12. Complete Step 5
    await completeStep(page, "Final Review");
    
    // 13. Verify workflow completes
    await verifyStepStates(page, {
      "Final Review": "COMPLETED"
    });
    
    // Verify workflow status is COMPLETED
    const workflowStatus = page.locator('text=/Workflow.*COMPLETED/i').first();
    await expect(workflowStatus).toBeVisible({ timeout: 5000 });
  });

  test("should show 3 parallel steps executing simultaneously in UI", async ({ page }) => {
    // This test verifies the UI correctly shows multiple READY steps at once
    
    await navigateToTemplates(page);
    await createForkJoinTemplate(page);
    
    const matterId = await findMatter(page);
    await attachWorkflowToMatter(page, matterId, TEMPLATE_NAME);
    
    await page.goto(`${baseUrl}/dashboard/matters/${matterId}`);
    await page.waitForTimeout(1000);
    
    // Complete Step 1
    await completeStep(page, "Initial Review");
    
    // Verify ALL 3 parallel steps show READY badges simultaneously
    const readyBadges = page.locator('text=/READY/i');
    const readyCount = await readyBadges.count();
    
    // Should have exactly 3 READY steps (Parallel Task A, B, C)
    expect(readyCount).toBe(3);
    
    // Verify each specific step is READY
    await expect(page.locator('text="Parallel Task A"').locator('..').locator('text=/READY/i')).toBeVisible();
    await expect(page.locator('text="Parallel Task B"').locator('..').locator('text=/READY/i')).toBeVisible();
    await expect(page.locator('text="Parallel Task C"').locator('..').locator('text=/READY/i')).toBeVisible();
  });
});
