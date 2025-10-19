/**
 * Client-side cycle detection utility for workflow dependencies
 * Mirrors the server-side logic but works with template draft data
 */

export interface StepDependency {
  order: number;
  dependsOn?: number[];
}

export interface CycleDetectionResult {
  hasCycles: boolean;
  cycles: Array<{ from: number; to: number }>;
  affectedSteps: Set<number>;
  description?: string;
}

/**
 * Detect cycles in workflow step dependencies using DFS
 * Returns all edges that are part of cycles
 */
export function detectCycles(steps: StepDependency[]): CycleDetectionResult {
  const result: CycleDetectionResult = {
    hasCycles: false,
    cycles: [],
    affectedSteps: new Set<number>(),
  };

  if (steps.length === 0) {
    return result;
  }

  // Build adjacency list
  const graph = new Map<number, number[]>();
  steps.forEach((step) => {
    if (!graph.has(step.order)) {
      graph.set(step.order, []);
    }
    if (step.dependsOn && step.dependsOn.length > 0) {
      step.dependsOn.forEach((depOrder) => {
        if (!graph.has(depOrder)) {
          graph.set(depOrder, []);
        }
        graph.get(depOrder)!.push(step.order);
      });
    }
  });

  // DFS with cycle detection
  const visited = new Set<number>();
  const recStack = new Set<number>();
  const cycleEdges = new Set<string>();

  function dfs(node: number, path: number[]): void {
    visited.add(node);
    recStack.add(node);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path, node]);
      } else if (recStack.has(neighbor)) {
        // Found a cycle! Mark all edges in the cycle
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart !== -1) {
          for (let i = cycleStart; i < path.length; i++) {
            cycleEdges.add(`${path[i]}-${path[i + 1] || neighbor}`);
            result.affectedSteps.add(path[i]);
          }
          result.affectedSteps.add(neighbor);
          cycleEdges.add(`${path[path.length - 1]}-${neighbor}`);
        } else {
          // Direct back edge
          cycleEdges.add(`${node}-${neighbor}`);
          result.affectedSteps.add(node);
          result.affectedSteps.add(neighbor);
        }
      }
    }

    recStack.delete(node);
  }

  // Run DFS from all nodes
  steps.forEach((step) => {
    if (!visited.has(step.order)) {
      dfs(step.order, []);
    }
  });

  // Convert edge strings to result format
  cycleEdges.forEach((edgeStr) => {
    const [from, to] = edgeStr.split("-").map(Number);
    result.cycles.push({ from, to });
  });

  result.hasCycles = result.cycles.length > 0;

  if (result.hasCycles) {
    const cycleSteps = Array.from(result.affectedSteps)
      .sort((a, b) => a - b)
      .join(", ");
    result.description = `Circular dependency detected involving steps: ${cycleSteps}`;
  }

  return result;
}

/**
 * Validate step dependencies (mirrors server-side validation)
 */
export interface ValidationError {
  field: string;
  message: string;
  stepOrder?: number;
}

export function validateStepDependencies(
  steps: StepDependency[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  steps.forEach((step) => {
    if (!step.dependsOn || step.dependsOn.length === 0) {
      return; // No dependencies, nothing to validate
    }

    // Check for self-dependency
    if (step.dependsOn.includes(step.order)) {
      errors.push({
        field: `steps[${step.order}].dependsOn`,
        message: "Step cannot depend on itself",
        stepOrder: step.order,
      });
    }

    // Check for duplicates
    const uniqueDeps = new Set(step.dependsOn);
    if (uniqueDeps.size !== step.dependsOn.length) {
      errors.push({
        field: `steps[${step.order}].dependsOn`,
        message: "Duplicate dependencies detected",
        stepOrder: step.order,
      });
    }

    // Check for invalid references (steps that don't exist)
    const validOrders = new Set(steps.map((s) => s.order));
    step.dependsOn.forEach((depOrder) => {
      if (!validOrders.has(depOrder)) {
        errors.push({
          field: `steps[${step.order}].dependsOn`,
          message: `Invalid dependency reference: Step ${depOrder} does not exist`,
          stepOrder: step.order,
        });
      }
    });

    // Check for forward dependencies (can only depend on previous steps by order)
    step.dependsOn.forEach((depOrder) => {
      if (depOrder >= step.order) {
        errors.push({
          field: `steps[${step.order}].dependsOn`,
          message: `Cannot depend on future step: Step ${depOrder}`,
          stepOrder: step.order,
        });
      }
    });
  });

  // Check for cycles
  const cycleResult = detectCycles(steps);
  if (cycleResult.hasCycles) {
    errors.push({
      field: "steps.dependsOn",
      message: cycleResult.description || "Circular dependencies detected",
    });
  }

  return errors;
}

/**
 * Get human-readable description of dependency structure
 */
export function describeDependencies(steps: StepDependency[]): string {
  const parallelGroups: { [key: number]: number[] } = {};

  // Find parallel execution groups (steps with same dependencies)
  steps.forEach((step) => {
    if (step.dependsOn && step.dependsOn.length > 0) {
      const depsKey = step.dependsOn.sort().join(",");
      const key = parseInt(depsKey.split(",")[0]);
      if (!parallelGroups[key]) {
        parallelGroups[key] = [];
      }
      parallelGroups[key].push(step.order);
    }
  });

  const descriptions: string[] = [];

  Object.entries(parallelGroups).forEach(([, group]) => {
    if (group.length > 1) {
      descriptions.push(
        `Steps ${group.join(", ")} execute in parallel (fork pattern)`
      );
    }
  });

  // Find convergence points (steps that depend on multiple parallel steps)
  steps.forEach((step) => {
    if (step.dependsOn && step.dependsOn.length > 1) {
      descriptions.push(
        `Step ${step.order} waits for steps ${step.dependsOn.join(", ")} (join pattern)`
      );
    }
  });

  if (descriptions.length === 0) {
    return "Sequential execution (no parallelism)";
  }

  return descriptions.join(" • ");
}
