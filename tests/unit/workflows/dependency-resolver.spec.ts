/**
 * Unit tests for Dependency Resolver (P0.2)
 * 
 * Tests flexible step dependencies including:
 * - Dependency satisfaction (ALL/ANY logic)
 * - Circular dependency detection
 * - Ready/blocked step calculation
 * - Dependency status reporting
 */

import { describe, it, expect } from "vitest";
import {
  isDependencySatisfied,
  getDependencyGraph,
  detectCycles,
  getReadySteps,
  getBlockedSteps,
  getDependencyStatus,
  validateWorkflowDependencies,
} from "@/lib/workflows/dependency-resolver";
import type { WorkflowInstanceStep, ActionState, DependencyLogic } from "@prisma/client";

// Helper to create mock step
function createStep(
  id: string,
  order: number,
  state: ActionState = "PENDING",
  dependsOn: string[] = [],
  dependencyLogic: DependencyLogic = "ALL"
): WorkflowInstanceStep {
  return {
    id,
    instanceId: "instance-1",
    templateStepId: null,
    order,
    title: `Step ${order}`,
    actionType: "TASK",
    roleScope: "LAWYER",
    required: true,
    actionState: state,
    actionData: null,
    assignedToId: null,
    dueDate: null,
    priority: "MEDIUM",
    notes: null,
    startedAt: null,
    completedAt: null,
    dependsOn,
    dependencyLogic,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("isDependencySatisfied", () => {
  it("should return true for step with no dependencies", () => {
    const step = createStep("1", 1, "PENDING", []);
    const allSteps = [step];

    expect(isDependencySatisfied(step, allSteps)).toBe(true);
  });

  it("should return true with ALL logic when all dependencies complete", () => {
    const step1 = createStep("1", 1, "COMPLETED");
    const step2 = createStep("2", 2, "COMPLETED");
    const step3 = createStep("3", 3, "PENDING", ["1", "2"], "ALL");
    const allSteps = [step1, step2, step3];

    expect(isDependencySatisfied(step3, allSteps)).toBe(true);
  });

  it("should return false with ALL logic when any dependency pending", () => {
    const step1 = createStep("1", 1, "COMPLETED");
    const step2 = createStep("2", 2, "PENDING");
    const step3 = createStep("3", 3, "PENDING", ["1", "2"], "ALL");
    const allSteps = [step1, step2, step3];

    expect(isDependencySatisfied(step3, allSteps)).toBe(false);
  });

  it("should return true with ANY logic when at least one dependency complete", () => {
    const step1 = createStep("1", 1, "COMPLETED");
    const step2 = createStep("2", 2, "PENDING");
    const step3 = createStep("3", 3, "PENDING", ["1", "2"], "ANY");
    const allSteps = [step1, step2, step3];

    expect(isDependencySatisfied(step3, allSteps)).toBe(true);
  });

  it("should return false with ANY logic when all dependencies pending", () => {
    const step1 = createStep("1", 1, "PENDING");
    const step2 = createStep("2", 2, "PENDING");
    const step3 = createStep("3", 3, "PENDING", ["1", "2"], "ANY");
    const allSteps = [step1, step2, step3];

    expect(isDependencySatisfied(step3, allSteps)).toBe(false);
  });

  it("should throw error for CUSTOM dependency logic (not implemented)", () => {
    const step1 = createStep("1", 1, "COMPLETED");
    const step2 = createStep("2", 2, "PENDING", ["1"], "CUSTOM");
    const allSteps = [step1, step2];

    expect(() => isDependencySatisfied(step2, allSteps)).toThrow(
      /CUSTOM.*not implemented/i
    );
  });

  it("should throw error for invalid dependency reference", () => {
    const step1 = createStep("1", 1, "PENDING", ["nonexistent"], "ALL");
    const allSteps = [step1];

    expect(() => isDependencySatisfied(step1, allSteps)).toThrow(
      /invalid dependencies/i
    );
  });
});

describe("getDependencyGraph", () => {
  it("should build correct graph for simple dependencies", () => {
    const step1 = createStep("1", 1, "PENDING", []);
    const step2 = createStep("2", 2, "PENDING", ["1"]);
    const step3 = createStep("3", 3, "PENDING", ["2"]);
    const allSteps = [step1, step2, step3];

    const graph = getDependencyGraph(allSteps);

    expect(graph.get("1")).toEqual([]);
    expect(graph.get("2")).toEqual(["1"]);
    expect(graph.get("3")).toEqual(["2"]);
  });

  it("should build correct graph for parallel dependencies", () => {
    const step1 = createStep("1", 1, "PENDING", []);
    const step2 = createStep("2", 2, "PENDING", []);
    const step3 = createStep("3", 3, "PENDING", ["1", "2"]);
    const allSteps = [step1, step2, step3];

    const graph = getDependencyGraph(allSteps);

    expect(graph.get("1")).toEqual([]);
    expect(graph.get("2")).toEqual([]);
    expect(graph.get("3")).toEqual(["1", "2"]);
  });
});

describe("detectCycles", () => {
  it("should detect no cycles in linear workflow", () => {
    const step1 = createStep("1", 1, "PENDING", []);
    const step2 = createStep("2", 2, "PENDING", ["1"]);
    const step3 = createStep("3", 3, "PENDING", ["2"]);
    const allSteps = [step1, step2, step3];

    const cycles = detectCycles(allSteps);

    expect(cycles).toHaveLength(0);
  });

  it("should detect simple circular dependency (A → B → A)", () => {
    const step1 = createStep("1", 1, "PENDING", ["2"]);
    const step2 = createStep("2", 2, "PENDING", ["1"]);
    const allSteps = [step1, step2];

    const cycles = detectCycles(allSteps);

    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles[0]).toContain("Step 1");
    expect(cycles[0]).toContain("Step 2");
  });

  it("should detect complex circular dependency (A → B → C → A)", () => {
    const step1 = createStep("1", 1, "PENDING", ["3"]);
    const step2 = createStep("2", 2, "PENDING", ["1"]);
    const step3 = createStep("3", 3, "PENDING", ["2"]);
    const allSteps = [step1, step2, step3];

    const cycles = detectCycles(allSteps);

    expect(cycles.length).toBeGreaterThan(0);
  });

  it("should detect no cycles in fork-join pattern", () => {
    const step1 = createStep("1", 1, "PENDING", []);
    const step2 = createStep("2", 2, "PENDING", ["1"]);
    const step3 = createStep("3", 3, "PENDING", ["1"]);
    const step4 = createStep("4", 4, "PENDING", ["2", "3"]);
    const allSteps = [step1, step2, step3, step4];

    const cycles = detectCycles(allSteps);

    expect(cycles).toHaveLength(0);
  });
});

describe("getReadySteps", () => {
  it("should return steps with no dependencies", () => {
    const step1 = createStep("1", 1, "PENDING", []);
    const step2 = createStep("2", 2, "PENDING", []);
    const step3 = createStep("3", 3, "PENDING", ["1", "2"]);
    const allSteps = [step1, step2, step3];

    const readySteps = getReadySteps(allSteps);

    expect(readySteps).toHaveLength(2);
    expect(readySteps.map((s) => s.id)).toEqual(["1", "2"]);
  });

  it("should return steps with satisfied dependencies", () => {
    const step1 = createStep("1", 1, "COMPLETED");
    const step2 = createStep("2", 2, "PENDING", ["1"]);
    const step3 = createStep("3", 3, "PENDING", ["2"]);
    const allSteps = [step1, step2, step3];

    const readySteps = getReadySteps(allSteps);

    expect(readySteps).toHaveLength(1);
    expect(readySteps[0].id).toBe("2");
  });

  it("should not return completed steps", () => {
    const step1 = createStep("1", 1, "COMPLETED");
    const step2 = createStep("2", 2, "COMPLETED", ["1"]);
    const allSteps = [step1, step2];

    const readySteps = getReadySteps(allSteps);

    expect(readySteps).toHaveLength(0);
  });

  it("should handle ANY logic correctly", () => {
    const step1 = createStep("1", 1, "COMPLETED");
    const step2 = createStep("2", 2, "PENDING");
    const step3 = createStep("3", 3, "PENDING", ["1", "2"], "ANY");
    const allSteps = [step1, step2, step3];

    const readySteps = getReadySteps(allSteps);

    // Step 3 should be ready because step 1 is complete (ANY logic)
    expect(readySteps.map((s) => s.id)).toContain("3");
  });
});

describe("getBlockedSteps", () => {
  it("should return steps with unsatisfied dependencies", () => {
    const step1 = createStep("1", 1, "PENDING");
    const step2 = createStep("2", 2, "PENDING", ["1"]);
    const step3 = createStep("3", 3, "PENDING", ["2"]);
    const allSteps = [step1, step2, step3];

    const blockedSteps = getBlockedSteps(allSteps);

    // Steps 2 and 3 are blocked
    expect(blockedSteps).toHaveLength(2);
    expect(blockedSteps.map((s) => s.id)).toEqual(["2", "3"]);
  });

  it("should not return steps with no dependencies", () => {
    const step1 = createStep("1", 1, "PENDING", []);
    const step2 = createStep("2", 2, "PENDING", ["1"]);
    const allSteps = [step1, step2];

    const blockedSteps = getBlockedSteps(allSteps);

    // Only step 2 is blocked
    expect(blockedSteps).toHaveLength(1);
    expect(blockedSteps[0].id).toBe("2");
  });

  it("should not return completed steps", () => {
    const step1 = createStep("1", 1, "COMPLETED");
    const step2 = createStep("2", 2, "COMPLETED", ["1"]);
    const allSteps = [step1, step2];

    const blockedSteps = getBlockedSteps(allSteps);

    expect(blockedSteps).toHaveLength(0);
  });
});

describe("getDependencyStatus", () => {
  it("should return correct status for step with no dependencies", () => {
    const step1 = createStep("1", 1, "PENDING", []);
    const allSteps = [step1];

    const status = getDependencyStatus(step1, allSteps);

    expect(status.isSatisfied).toBe(true);
    expect(status.dependencyCount).toBe(0);
    expect(status.completedCount).toBe(0);
    expect(status.pendingDependencies).toHaveLength(0);
  });

  it("should return correct status for step with completed dependencies", () => {
    const step1 = createStep("1", 1, "COMPLETED");
    const step2 = createStep("2", 2, "COMPLETED");
    const step3 = createStep("3", 3, "PENDING", ["1", "2"], "ALL");
    const allSteps = [step1, step2, step3];

    const status = getDependencyStatus(step3, allSteps);

    expect(status.isSatisfied).toBe(true);
    expect(status.dependencyCount).toBe(2);
    expect(status.completedCount).toBe(2);
    expect(status.pendingDependencies).toHaveLength(0);
  });

  it("should return correct status for step with pending dependencies", () => {
    const step1 = createStep("1", 1, "COMPLETED");
    const step2 = createStep("2", 2, "PENDING");
    const step3 = createStep("3", 3, "PENDING", ["1", "2"], "ALL");
    const allSteps = [step1, step2, step3];

    const status = getDependencyStatus(step3, allSteps);

    expect(status.isSatisfied).toBe(false);
    expect(status.dependencyCount).toBe(2);
    expect(status.completedCount).toBe(1);
    expect(status.pendingDependencies).toHaveLength(1);
    expect(status.pendingDependencies[0].id).toBe("2");
  });

  it("should include dependency logic in status", () => {
    const step1 = createStep("1", 1, "PENDING");
    const step2 = createStep("2", 2, "PENDING", ["1"], "ANY");
    const allSteps = [step1, step2];

    const status = getDependencyStatus(step2, allSteps);

    expect(status.logic).toBe("ANY");
  });
});

describe("validateWorkflowDependencies", () => {
  it("should validate workflow with no cycles", () => {
    const steps = [
      createStep("1", 1, "PENDING", []),
      createStep("2", 2, "PENDING", ["1"]),
      createStep("3", 3, "PENDING", ["2"]),
    ];

    const result = validateWorkflowDependencies(steps);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject workflow with circular dependencies", () => {
    const steps = [
      createStep("1", 1, "PENDING", ["2"]),
      createStep("2", 2, "PENDING", ["1"]),
    ];

    const result = validateWorkflowDependencies(steps);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("Circular dependency");
  });

  it("should reject step with self-dependency", () => {
    const steps = [createStep("1", 1, "PENDING", ["1"])];

    const result = validateWorkflowDependencies(steps);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Circular dependency detected");
  });

  it("should reject step with invalid dependency reference", () => {
    const steps = [createStep("1", 1, "PENDING", ["nonexistent"])];

    const result = validateWorkflowDependencies(steps);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("invalid dependencies");
  });

  it("should validate fork-join pattern", () => {
    const steps = [
      createStep("1", 1, "PENDING", []),
      createStep("2", 2, "PENDING", ["1"]),
      createStep("3", 3, "PENDING", ["1"]),
      createStep("4", 4, "PENDING", ["2", "3"]),
    ];

    const result = validateWorkflowDependencies(steps);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
