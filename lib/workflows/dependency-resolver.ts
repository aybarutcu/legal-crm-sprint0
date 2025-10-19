/**
 * Dependency Resolver for Flexible Step Dependencies (P0.2)
 * 
 * Provides functions to:
 * - Check if step dependencies are satisfied
 * - Detect circular dependencies
 * - Calculate ready/blocked steps
 * - Build dependency graphs for visualization
 */

import type { WorkflowInstanceStep, DependencyLogic, ActionState } from "@prisma/client";

/**
 * Check if a step's dependencies are satisfied
 * 
 * @param step - The step to check
 * @param allSteps - All steps in the workflow instance
 * @returns true if dependencies are satisfied, false otherwise
 * @throws Error if dependencies are invalid or logic not implemented
 */
export function isDependencySatisfied(
  step: WorkflowInstanceStep,
  allSteps: WorkflowInstanceStep[]
): boolean {
  // No dependencies = always satisfied
  if (!step.dependsOn || step.dependsOn.length === 0) {
    return true;
  }

  // Find the steps this step depends on
  const dependencySteps = allSteps.filter((s) => step.dependsOn.includes(s.id));

  // Validate all dependencies exist
  if (dependencySteps.length !== step.dependsOn.length) {
    const missingIds = step.dependsOn.filter(
      (id) => !allSteps.find((s) => s.id === id)
    );
    throw new Error(
      `Step ${step.id} has invalid dependencies: ${missingIds.join(", ")}`
    );
  }

  // Count completed dependencies
  const completedDeps = dependencySteps.filter(
    (s) => s.actionState === "COMPLETED"
  );

  // Apply dependency logic
  switch (step.dependencyLogic) {
    case "ALL":
      // All dependencies must be complete
      return completedDeps.length === dependencySteps.length;

    case "ANY":
      // At least one dependency must be complete
      return completedDeps.length > 0;

    case "CUSTOM":
      // Custom logic not implemented yet
      throw new Error(
        `Dependency logic "CUSTOM" is not implemented for step ${step.id}`
      );

    default:
      throw new Error(
        `Unknown dependency logic "${step.dependencyLogic}" for step ${step.id}`
      );
  }
}

/**
 * Build dependency graph for validation/visualization
 * 
 * @param steps - All steps in the workflow
 * @returns Map of step ID to array of dependency step IDs
 */
export function getDependencyGraph(
  steps: WorkflowInstanceStep[]
): Map<string, string[]> {
  const graph = new Map<string, string[]>();

  for (const step of steps) {
    graph.set(step.id, step.dependsOn || []);
  }

  return graph;
}

/**
 * Detect circular dependencies using depth-first search
 * 
 * @param steps - All steps in the workflow
 * @returns Array of cycle descriptions (empty if no cycles)
 * 
 * Example: ["A → B → C → A", "D → E → D"]
 */
export function detectCycles(steps: WorkflowInstanceStep[]): string[] {
  const graph = getDependencyGraph(steps);
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[] = [];

  // Build map of step IDs to titles for readable cycle messages
  const stepTitles = new Map<string, string>();
  for (const step of steps) {
    stepTitles.set(step.id, step.title);
  }

  function dfs(nodeId: string, path: string[]): void {
    // Cycle detected - node already in recursion stack
    if (recursionStack.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      const cyclePath = path.slice(cycleStart).concat(nodeId);
      const cycleDesc = cyclePath
        .map((id) => stepTitles.get(id) || id)
        .join(" → ");
      cycles.push(cycleDesc);
      return;
    }

    // Already fully explored this node
    if (visited.has(nodeId)) {
      return;
    }

    // Mark as visited and in current path
    visited.add(nodeId);
    recursionStack.add(nodeId);

    // Explore dependencies
    const dependencies = graph.get(nodeId) || [];
    for (const depId of dependencies) {
      dfs(depId, [...path, nodeId]);
    }

    // Remove from recursion stack
    recursionStack.delete(nodeId);
  }

  // Check all nodes for cycles
  for (const step of steps) {
    if (!visited.has(step.id)) {
      dfs(step.id, []);
    }
  }

  return cycles;
}

/**
 * Get all steps that are ready to execute (dependencies satisfied)
 * 
 * @param steps - All steps in the workflow
 * @returns Array of steps that can be started
 */
export function getReadySteps(
  steps: WorkflowInstanceStep[]
): WorkflowInstanceStep[] {
  return steps.filter((step) => {
    // Skip completed, failed, or skipped steps
    if (["COMPLETED", "FAILED", "SKIPPED"].includes(step.actionState)) {
      return false;
    }

    // Skip steps already in progress
    if (step.actionState === "IN_PROGRESS") {
      return false;
    }

    // Check if dependencies are satisfied
    try {
      return isDependencySatisfied(step, steps);
    } catch (error) {
      // If dependency check fails, step is not ready
      console.error(`Error checking dependencies for step ${step.id}:`, error);
      return false;
    }
  });
}

/**
 * Get steps blocked by unsatisfied dependencies
 * 
 * @param steps - All steps in the workflow
 * @returns Array of steps waiting on dependencies
 */
export function getBlockedSteps(
  steps: WorkflowInstanceStep[]
): WorkflowInstanceStep[] {
  return steps.filter((step) => {
    // Only consider pending steps
    if (step.actionState !== "PENDING" && step.actionState !== "BLOCKED") {
      return false;
    }

    // Check if blocked by dependencies
    try {
      return !isDependencySatisfied(step, steps);
    } catch (error) {
      // If dependency check fails, consider it blocked
      console.error(`Error checking dependencies for step ${step.id}:`, error);
      return true;
    }
  });
}

/**
 * Dependency status information for a step
 */
export interface DependencyStatus {
  stepId: string;
  stepTitle: string;
  isSatisfied: boolean;
  dependencyCount: number;
  completedCount: number;
  pendingDependencies: Array<{ id: string; title: string; state: ActionState }>;
  logic: DependencyLogic;
}

/**
 * Get detailed dependency status for a step
 * 
 * @param step - The step to check
 * @param allSteps - All steps in the workflow
 * @returns Detailed dependency status information
 */
export function getDependencyStatus(
  step: WorkflowInstanceStep,
  allSteps: WorkflowInstanceStep[]
): DependencyStatus {
  // No dependencies
  if (!step.dependsOn || step.dependsOn.length === 0) {
    return {
      stepId: step.id,
      stepTitle: step.title,
      isSatisfied: true,
      dependencyCount: 0,
      completedCount: 0,
      pendingDependencies: [],
      logic: step.dependencyLogic,
    };
  }

  const dependencySteps = allSteps.filter((s) => step.dependsOn.includes(s.id));
  const completedDeps = dependencySteps.filter((s) => s.actionState === "COMPLETED");
  const pendingDeps = dependencySteps.filter((s) => s.actionState !== "COMPLETED");

  let isSatisfied = false;
  try {
    isSatisfied = isDependencySatisfied(step, allSteps);
  } catch (error) {
    // If check fails, not satisfied
    isSatisfied = false;
  }

  return {
    stepId: step.id,
    stepTitle: step.title,
    isSatisfied,
    dependencyCount: dependencySteps.length,
    completedCount: completedDeps.length,
    pendingDependencies: pendingDeps.map((s) => ({
      id: s.id,
      title: s.title,
      state: s.actionState,
    })),
    logic: step.dependencyLogic,
  };
}

/**
 * Validate workflow dependencies before creation
 * 
 * @param steps - All steps in the workflow template/instance
 * @returns Validation result with errors
 */
export function validateWorkflowDependencies(
  steps: WorkflowInstanceStep[] | Array<{ id: string; dependsOn: string[] }>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Convert to format needed for cycle detection
  const stepsForValidation = steps.map((s) => ({
    id: s.id,
    title: "title" in s ? s.title : s.id,
    dependsOn: s.dependsOn || [],
  })) as WorkflowInstanceStep[];

  // Check for cycles
  const cycles = detectCycles(stepsForValidation);
  if (cycles.length > 0) {
    errors.push(...cycles.map((cycle) => `Circular dependency detected: ${cycle}`));
  }

  // Check for self-dependencies
  for (const step of steps) {
    if (step.dependsOn && step.dependsOn.includes(step.id)) {
      const title = "title" in step ? step.title : step.id;
      errors.push(`Step "${title}" cannot depend on itself`);
    }
  }

  // Check for invalid dependency references
  const stepIds = new Set(steps.map((s) => s.id));
  for (const step of steps) {
    if (step.dependsOn) {
      const invalidDeps = step.dependsOn.filter((depId) => !stepIds.has(depId));
      if (invalidDeps.length > 0) {
        const title = "title" in step ? step.title : step.id;
        errors.push(
          `Step "${title}" has invalid dependencies: ${invalidDeps.join(", ")}`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
