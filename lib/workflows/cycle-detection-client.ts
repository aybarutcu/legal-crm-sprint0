/**
 * Client-side cycle detection utility for workflow dependencies
 * Mirrors the server-side logic but works with template draft data
 */

export interface StepDependency {
  id: string;
  dependsOn?: string[];
}

export interface CycleDetectionResult {
  hasCycles: boolean;
  cycles: Array<{ from: string; to: string }>;
  affectedSteps: Set<string>;
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
    affectedSteps: new Set<string>(),
  };

  if (steps.length === 0) {
    return result;
  }

  // Build adjacency list
  const graph = new Map<string, string[]>();
  steps.forEach((step) => {
    if (!graph.has(step.id)) {
      graph.set(step.id, []);
    }
    if (step.dependsOn && step.dependsOn.length > 0) {
      step.dependsOn.forEach((depId) => {
        if (!graph.has(depId)) {
          graph.set(depId, []);
        }
        graph.get(depId)!.push(step.id);
      });
    }
  });

  // DFS with cycle detection
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const cycleEdges = new Set<string>();

  function dfs(node: string, path: string[]): void {
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
    if (!visited.has(step.id)) {
      dfs(step.id, []);
    }
  });

  // Convert edge strings to result format
  cycleEdges.forEach((edgeStr) => {
    const [from, to] = edgeStr.split("-");
    result.cycles.push({ from, to });
  });

  result.hasCycles = result.cycles.length > 0;

  if (result.hasCycles) {
    const cycleSteps = Array.from(result.affectedSteps)
      .sort()
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
  stepId?: string;
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
    if (step.dependsOn.includes(step.id)) {
      errors.push({
        field: `steps[${step.id}].dependsOn`,
        message: "Step cannot depend on itself",
        stepId: step.id,
      });
    }

    // Check for duplicates
    const uniqueDeps = new Set(step.dependsOn);
    if (uniqueDeps.size !== step.dependsOn.length) {
      errors.push({
        field: `steps[${step.id}].dependsOn`,
        message: "Duplicate dependencies detected",
        stepId: step.id,
      });
    }

    // Check for invalid references (steps that don't exist)
    const validIds = new Set(steps.map((s) => s.id));
    step.dependsOn.forEach((depId) => {
      if (!validIds.has(depId)) {
        errors.push({
          field: `steps[${step.id}].dependsOn`,
          message: `Invalid dependency reference: Step ${depId} does not exist`,
          stepId: step.id,
        });
      }
    });

    // Note: Forward dependency check removed since we now use stable IDs instead of order-based dependencies
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
  const descriptions: string[] = [];

  // Describe each step's dependencies
  steps.forEach((step) => {
    if (step.dependsOn && step.dependsOn.length > 0) {
      descriptions.push(
        `Step ${step.id} depends on: ${step.dependsOn.join(", ")}`
      );
    } else {
      descriptions.push(`Step ${step.id} has no dependencies`);
    }
  });

  if (descriptions.length === 0) {
    return "No steps defined";
  }

  return descriptions.join(" • ");
}
