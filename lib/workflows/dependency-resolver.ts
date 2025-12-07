/**
 * Dependency Resolver for Flexible Step Dependencies (P0.2)
 * 
 * Provides functions to:
 * - Check if step dependencies are satisfied
 * - Detect circular dependencies
 * - Calculate ready/blocked steps
 * - Build dependency graphs for visualization
 */

import { WorkflowInstanceStep, WorkflowInstanceDependency, ActionState, DependencyLogic } from "@prisma/client";

/**
 * Check if a step's dependencies are satisfied using edge-based dependencies
 * 
 * @param step - The step to check
 * @param dependencies - All dependencies in the workflow instance
 * @param allSteps - All steps in the workflow instance
 * @returns true if dependencies are satisfied, false otherwise
 */
export function isDependencySatisfied(
  step: WorkflowInstanceStep,
  dependencies: WorkflowInstanceDependency[],
  allSteps: WorkflowInstanceStep[]
): boolean {
  // Find all incoming dependencies for this step
  const incomingDeps = dependencies.filter(dep => dep.targetStepId === step.id);

  // No dependencies = always satisfied
  if (incomingDeps.length === 0) {
    return true;
  }

  // Group dependencies by logic type
  const allDeps = incomingDeps.filter(dep => dep.dependencyLogic === "ALL");
  const anyDeps = incomingDeps.filter(dep => dep.dependencyLogic === "ANY");

  // Check ALL dependencies (if any exist)
  if (allDeps.length > 0) {
    const allComplete = allDeps.every(dep => {
      const sourceStep = allSteps.find(s => s.id === dep.sourceStepId);
      return sourceStep?.actionState === "COMPLETED";
    });
    if (!allComplete) return false;
  }

  // Check ANY dependencies (if any exist)
  if (anyDeps.length > 0) {
    const anyComplete = anyDeps.some(dep => {
      const sourceStep = allSteps.find(s => s.id === dep.sourceStepId);
      return sourceStep?.actionState === "COMPLETED";
    });
    if (!anyComplete) return false;
  }

  return true;
}

/**
 * Build dependency graph for validation/visualization using edge-based dependencies
 * 
 * @param dependencies - All dependencies in the workflow
 * @returns Map of step ID to array of dependency step IDs
 */
export function getDependencyGraph(
  dependencies: WorkflowInstanceDependency[]
): Map<string, string[]> {
  const graph = new Map<string, string[]>();

  // Build adjacency list: target -> [sources]
  dependencies.forEach(dep => {
    if (!graph.has(dep.targetStepId)) {
      graph.set(dep.targetStepId, []);
    }
    graph.get(dep.targetStepId)!.push(dep.sourceStepId);
  });

  return graph;
}

/**
 * Detect circular dependencies using depth-first search with edge-based dependencies
 * 
 * @param dependencies - All dependencies in the workflow
 * @param steps - All steps in the workflow
 * @returns Array of cycle descriptions (empty if no cycles)
 */
export function detectCycles(
  dependencies: WorkflowInstanceDependency[],
  steps: WorkflowInstanceStep[]
): string[] {
  const graph = getDependencyGraph(dependencies);
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[] = [];

  // Build map of step IDs to titles for readable cycle messages
  const stepTitles = new Map<string, string>();
  for (const step of steps) {
    stepTitles.set(step.id, step.title);
  }

  function dfs(stepId: string, path: string[]): void {
    // Cycle detected - node already in recursion stack
    if (recursionStack.has(stepId)) {
      const cycleStart = path.indexOf(stepId);
      const cyclePath = path.slice(cycleStart).concat(stepId);
      const cycleDesc = cyclePath
        .map((id) => stepTitles.get(id) || id)
        .join(" → ");
      cycles.push(cycleDesc);
      return;
    }

    // Already fully explored this node
    if (visited.has(stepId)) {
      return;
    }

    // Mark as visited and in current path
    visited.add(stepId);
    recursionStack.add(stepId);

    // Explore dependencies (what this step depends on)
    const stepDependencies = graph.get(stepId) || [];
    for (const depId of stepDependencies) {
      dfs(depId, [...path, stepId]);
    }

    // Remove from recursion stack
    recursionStack.delete(stepId);
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
 * Get steps that are ready to be executed (all dependencies satisfied)
 * 
 * @param steps - All steps in the workflow instance
 * @param dependencies - All dependencies in the workflow instance
 * @returns Array of steps that can be marked as READY
 */
export function getReadySteps(
  steps: WorkflowInstanceStep[],
  dependencies: WorkflowInstanceDependency[]
): WorkflowInstanceStep[] {
  return steps.filter(step => {
    // Skip steps that are already in progress or completed
    if (step.actionState !== "PENDING") {
      return false;
    }

    // Check if this step's dependencies are satisfied
    return isDependencySatisfied(step, dependencies, steps);
  });
}

/**
 * Get steps blocked by unsatisfied dependencies
 * 
 * @param steps - All steps in the workflow instance
 * @param dependencies - All dependencies in the workflow instance
 * @returns Array of steps waiting on dependencies
 */
export function getBlockedSteps(
  steps: WorkflowInstanceStep[],
  dependencies: WorkflowInstanceDependency[]
): WorkflowInstanceStep[] {
  return steps.filter((step) => {
    // Only consider pending steps
    if (step.actionState !== "PENDING" && step.actionState !== "BLOCKED") {
      return false;
    }

    // Check if blocked by dependencies
    try {
      return !isDependencySatisfied(step, dependencies, steps);
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
 * @param dependencies - All dependencies in the workflow instance
 * @param allSteps - All steps in the workflow instance
 * @returns Detailed dependency status information
 */
export function getDependencyStatus(
  step: WorkflowInstanceStep,
  dependencies: WorkflowInstanceDependency[],
  allSteps: WorkflowInstanceStep[]
): DependencyStatus {
  // Find dependencies for this step
  const stepDependencies = dependencies.filter(dep => dep.targetStepId === step.id);
  
  // No dependencies
  if (stepDependencies.length === 0) {
    return {
      stepId: step.id,
      stepTitle: step.title,
      isSatisfied: true,
      dependencyCount: 0,
      completedCount: 0,
      pendingDependencies: [],
      logic: "ALL", // Default logic when no dependencies
    };
  }

  // Get the dependency logic from the first dependency (they should all be the same for a target step)
  const logic = stepDependencies[0].dependencyLogic;
  
  // Get dependency steps
  const dependencySteps = stepDependencies.map(dep => 
    allSteps.find(s => s.id === dep.sourceStepId)
  ).filter(Boolean) as WorkflowInstanceStep[];
  
  const completedDeps = dependencySteps.filter((s) => s.actionState === "COMPLETED");
  const pendingDeps = dependencySteps.filter((s) => s.actionState !== "COMPLETED");

  let isSatisfied = false;
  try {
    isSatisfied = isDependencySatisfied(step, dependencies, allSteps);
  } catch {
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
    logic,
  };
}

/**
 * Validate workflow dependencies before creation
 * 
 * @param steps - All steps in the workflow template/instance
 * @param dependencies - All dependencies in the workflow
 * @returns Validation result with errors
 */
export function validateWorkflowDependencies(
  steps: WorkflowInstanceStep[],
  dependencies: WorkflowInstanceDependency[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for cycles
  const cycles = detectCycles(dependencies, steps);
  if (cycles.length > 0) {
    errors.push(...cycles.map((cycle) => `Circular dependency detected: ${cycle}`));
  }

  // Check for self-dependencies
  for (const dep of dependencies) {
    if (dep.sourceStepId === dep.targetStepId) {
      const step = steps.find(s => s.id === dep.sourceStepId);
      const title = step ? step.title : dep.sourceStepId;
      errors.push(`Step "${title}" cannot depend on itself`);
    }
  }

  // Check for invalid dependency references
  const stepIds = new Set(steps.map((s) => s.id));
  for (const dep of dependencies) {
    if (!stepIds.has(dep.sourceStepId)) {
      errors.push(`Dependency references invalid source step: ${dep.sourceStepId}`);
    }
    if (!stepIds.has(dep.targetStepId)) {
      errors.push(`Dependency references invalid target step: ${dep.targetStepId}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
