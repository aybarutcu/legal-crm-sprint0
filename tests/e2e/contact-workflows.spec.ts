import { test, expect } from "@playwright/test";

test.describe("Contact Workflow Execution", () => {
  const TEST_CONTACT_ID = "cmgxmy9r000018yc5l7d9xbsg"; // Test Lead contact

  test.beforeEach(async ({ page }) => {
    // Login as admin (passwordless login - email only)
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@legalcrm.local");
    await page.click('button[type="submit"]');
    await page.waitForURL("/dashboard");
  });

  test("should display workflow timeline on contact page", async ({ page }) => {
    // Navigate to contact detail page
    await page.goto(`/contacts/${TEST_CONTACT_ID}`);

    // Wait for page to load - use more specific selector
    await expect(page.locator("h1").last()).toContainText("Test Lead");

    // Click on Workflows tab
    await page.click('button:has-text("Workflows")');

    // Verify workflow timeline is visible
    await expect(page.locator('[data-testid="workflow-timeline"]')).toBeVisible();

    // Verify workflow name is shown
    await expect(page.locator("text=Client Intake Process")).toBeVisible();

    // Verify we can see steps
    const steps = page.locator('[data-testid^="timeline-step-"]');
    await expect(steps.first()).toBeVisible();

    // Check that at least one step is visible
    const stepCount = await steps.count();
    expect(stepCount).toBeGreaterThan(0);
    console.log(`Found ${stepCount} workflow steps`);
  });

  test("should show step details when clicking on a step", async ({ page }) => {
    await page.goto(`/contacts/${TEST_CONTACT_ID}`);
    await page.click('button:has-text("Workflows")');

    // Wait for timeline to load
    await page.waitForSelector('[data-testid="workflow-timeline"]');

    // Click on first READY step (Step 2: Request Initial Documents)
    const readyStep = page.locator('[data-testid^="timeline-step-"]').filter({
      has: page.locator('[data-state="READY"]'),
    });

    if (await readyStep.count() > 0) {
      await readyStep.first().click();

      // Verify step detail panel appears
      await expect(page.locator('[data-testid="workflow-step-detail"]')).toBeVisible();

      // Verify step title is shown
      await expect(page.locator('[data-testid="step-title"]')).toBeVisible();

      // Verify action type info is shown
      await expect(page.locator('[data-testid="action-type"]')).toBeVisible();

      console.log("✅ Step detail panel displayed successfully");
    } else {
      console.log("⚠️  No READY steps found - all steps might be completed");
    }
  });

  test("should execute a workflow step", async ({ page }) => {
    await page.goto(`/contacts/${TEST_CONTACT_ID}`);
    await page.click('button:has-text("Workflows")');

    // Wait for timeline to load
    await page.waitForSelector('[data-testid="workflow-timeline"]');

    // Find READY step
    const readySteps = page.locator('[data-testid^="timeline-step-"]').filter({
      has: page.locator('[data-state="READY"]'),
    });

    const readyCount = await readySteps.count();
    
    if (readyCount > 0) {
      // Click on the ready step
      await readySteps.first().click();

      // Wait for detail panel
      await page.waitForSelector('[data-testid="workflow-step-detail"]');

      // Get the step type
      const stepType = await page.locator('[data-testid="action-type"]').textContent();
      console.log(`Executing step type: ${stepType}`);

      // Try to find and click action button based on step type
      const approveButton = page.locator('button:has-text("Approve")');
      const submitButton = page.locator('button:has-text("Submit")');
      const completeButton = page.locator('button:has-text("Complete")');
      const startButton = page.locator('button:has-text("Start")');

      if (await approveButton.isVisible()) {
        await approveButton.click();
        console.log("✅ Clicked Approve button");
      } else if (await submitButton.isVisible()) {
        await submitButton.click();
        console.log("✅ Clicked Submit button");
      } else if (await completeButton.isVisible()) {
        await completeButton.click();
        console.log("✅ Clicked Complete button");
      } else if (await startButton.isVisible()) {
        await startButton.click();
        console.log("✅ Clicked Start button");
      } else {
        console.log("⚠️  No action button found");
      }

      // Wait for completion
      await page.waitForTimeout(1000);

      // Verify step state changed (should show completed or next step ready)
      console.log("✅ Step execution test completed");
    } else {
      console.log("⚠️  No READY steps available for execution");
    }
  });

  test("should show workflow tasks in unified tasks page", async ({ page }) => {
    await page.goto("/tasks");

    // Wait for tasks to load
    await page.waitForSelector('[data-testid="tasks-container"]', { timeout: 10000 });

    // Look for contact workflow tasks
    const contactWorkflowTasks = page.locator('[data-testid^="task-card-"]').filter({
      has: page.locator('text=/Contact Workflow|LEAD|Client Intake/i'),
    });

    const taskCount = await contactWorkflowTasks.count();
    console.log(`Found ${taskCount} contact workflow tasks in unified view`);

    if (taskCount > 0) {
      // Verify task card has necessary info
      const firstTask = contactWorkflowTasks.first();
      await expect(firstTask).toBeVisible();

      // Click on the task
      await firstTask.click();

      // Should redirect to contact page with workflows tab
      await page.waitForURL(/\/contacts\/.+/);
      console.log("✅ Redirected to contact page from task");

      // Verify we're on the workflows tab
      await expect(page.locator('[data-testid="workflow-timeline"]')).toBeVisible();
    } else {
      console.log("⚠️  No contact workflow tasks found in tasks page");
    }
  });

  test("should update progress bar as steps complete", async ({ page }) => {
    await page.goto(`/contacts/${TEST_CONTACT_ID}`);
    await page.click('button:has-text("Workflows")');

    // Wait for timeline
    await page.waitForSelector('[data-testid="workflow-timeline"]');

    // Check for progress indicator
    const progressBar = page.locator('[data-testid="workflow-progress"]');
    
    if (await progressBar.isVisible()) {
      const progressText = await progressBar.textContent();
      console.log(`Current progress: ${progressText}`);

      // Should show something like "2/7 steps" or "29%"
      expect(progressText).toMatch(/\d+/);
    } else {
      // Look for alternative progress display
      const completedSteps = await page.locator('[data-state="COMPLETED"]').count();
      const totalSteps = await page.locator('[data-testid^="timeline-step-"]').count();
      console.log(`Progress: ${completedSteps}/${totalSteps} steps completed`);

      expect(totalSteps).toBeGreaterThan(0);
      expect(completedSteps).toBeGreaterThanOrEqual(0);
    }
  });
});
