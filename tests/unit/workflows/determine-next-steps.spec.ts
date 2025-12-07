/**
 * Unit Tests for determineNextSteps - Conditional Workflow Logic
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ActionState, ActionType, RoleScope, WorkflowInstanceStatus } from "@prisma/client";
import { determineNextSteps } from "@/lib/workflows/runtime";
import type { WorkflowInstance } from "@prisma/client";
import type { Prisma } from "@prisma/client";

// Mock Prisma transaction
const createMockTx = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const steps: any[] = [];
  
  return {
    workflowInstanceStep: {
      findMany: vi.fn(async () => steps),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: vi.fn(async ({ where, data }: any) => {
        const step = steps.find(s => s.id === where.id);
        if (step) {
          Object.assign(step, data);
        }
        return step;
      }),
    },
    _steps: steps,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
};

// Mock workflow instance
const createMockInstance = (contextData: Record<string, unknown> = {}): WorkflowInstance => ({
  id: "instance-1",
  templateId: "template-1",
  templateVersion: 1,
  matterId: "matter-1",
  contactId: null,
  createdById: "user-1",
  status: WorkflowInstanceStatus.ACTIVE,
  contextData: contextData as Prisma.JsonValue,
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Mock workflow step
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createMockStep = (overrides: any = {}) => ({
  id: `step-${overrides.order || 1}`,
  instanceId: "instance-1",
  templateStepId: null,
  order: 1,
  title: "Test Step",
  actionType: ActionType.APPROVAL,
  roleScope: RoleScope.LAWYER,
  required: true,
  actionState: ActionState.PENDING,
  actionData: null,
  assignedToId: null,
  dueDate: null,
  priority: null,
  notes: null,
  startedAt: null,
  completedAt: null,
  dependsOn: overrides.order > 1 ? [`step-${overrides.order - 1}`] : [], // Implicit sequential dependency
  dependencyLogic: "ALL",
  createdAt: new Date(),
  updatedAt: new Date(),
  instance: createMockInstance(),
  templateStep: null,
  ...overrides,
});

// Mock notifications module
vi.mock("@/lib/workflows/notifications", () => ({
  notifyStepReady: vi.fn(async () => {}),
}));

describe("determineNextSteps - Conditional Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Linear Workflows (ALWAYS condition)", () => {
    it("should activate first PENDING step with no condition", async () => {
      const tx = createMockTx();
      const instance = createMockInstance();
      
      tx._steps.push(
        createMockStep({ order: 1, actionState: ActionState.COMPLETED }),
        createMockStep({ order: 2, actionState: ActionState.PENDING, conditionType: "ALWAYS" }),
        createMockStep({ order: 3, actionState: ActionState.PENDING }),
      );

      const activated = await determineNextSteps({ tx, instance });

      expect(activated).toBe(1);
      expect(tx.workflowInstanceStep.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "step-2" },
          data: expect.objectContaining({
            actionState: ActionState.READY,
          }),
        }),
      );
    });

    it("should not activate steps if prior steps not completed", async () => {
      const tx = createMockTx();
      const instance = createMockInstance();
      
      tx._steps.push(
        createMockStep({ order: 1, actionState: ActionState.IN_PROGRESS }),
        createMockStep({ order: 2, actionState: ActionState.PENDING }),
      );

      const activated = await determineNextSteps({ tx, instance });

      expect(activated).toBe(0);
      expect(tx.workflowInstanceStep.update).not.toHaveBeenCalled();
    });

    it("should return 0 if no PENDING steps exist", async () => {
      const tx = createMockTx();
      const instance = createMockInstance();
      
      tx._steps.push(
        createMockStep({ order: 1, actionState: ActionState.COMPLETED }),
        createMockStep({ order: 2, actionState: ActionState.COMPLETED }),
      );

      const activated = await determineNextSteps({ tx, instance });

      expect(activated).toBe(0);
    });
  });

  describe("Conditional Workflows (IF_TRUE)", () => {
    it("should activate step when IF_TRUE condition evaluates to true", async () => {
      const tx = createMockTx();
      const instance = createMockInstance({ approved: true });
      
      tx._steps.push(
        createMockStep({ order: 1, actionState: ActionState.COMPLETED }),
        createMockStep({
          order: 2,
          actionState: ActionState.PENDING,
          conditionType: "IF_TRUE",
          conditionConfig: {
            type: "simple",
            field: "workflow.context.approved",
            operator: "==",
            value: true,
          },
        }),
      );

      const activated = await determineNextSteps({ tx, instance });

      expect(activated).toBe(1);
      expect(tx.workflowInstanceStep.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "step-2" },
          data: expect.objectContaining({
            actionState: ActionState.READY,
          }),
        }),
      );
    });

    it("should skip step when IF_TRUE condition evaluates to false", async () => {
      const tx = createMockTx();
      const instance = createMockInstance({ approved: false });
      
      tx._steps.push(
        createMockStep({ order: 1, actionState: ActionState.COMPLETED }),
        createMockStep({
          order: 2,
          actionState: ActionState.PENDING,
          conditionType: "IF_TRUE",
          conditionConfig: {
            type: "simple",
            field: "workflow.context.approved",
            operator: "==",
            value: true,
          },
        }),
        createMockStep({ order: 3, actionState: ActionState.PENDING }),
      );

      const activated = await determineNextSteps({ tx, instance });

      // Should skip step 2 and continue evaluating
      const _activated = await determineNextSteps({ tx, instance });

      // Check that step was skipped
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateCalls = (tx.workflowInstanceStep.update as any).mock.calls;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const skipCall = updateCalls.find((call: any) => 
        call[0].where.id === "step-2" && call[0].data.actionState === ActionState.SKIPPED
      );
      
      expect(skipCall).toBeDefined();
      expect(skipCall[0].data.notes).toContain("Condition not met");
    });
  });

  describe("Conditional Workflows (IF_FALSE)", () => {
    it("should activate step when IF_FALSE condition evaluates to false", async () => {
      const tx = createMockTx();
      const instance = createMockInstance({ needsReview: false });
      
      tx._steps.push(
        createMockStep({ order: 1, actionState: ActionState.COMPLETED }),
        createMockStep({
          order: 2,
          actionState: ActionState.PENDING,
          conditionType: "IF_FALSE",
          conditionConfig: {
            type: "simple",
            field: "workflow.context.needsReview",
            operator: "==",
            value: true,
          },
        }),
      );

      const activated = await determineNextSteps({ tx, instance });

      expect(activated).toBe(1);
      expect(tx.workflowInstanceStep.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "step-2" },
          data: expect.objectContaining({
            actionState: ActionState.READY,
          }),
        }),
      );
    });

    it("should skip step when IF_FALSE condition evaluates to true", async () => {
      const tx = createMockTx();
      const instance = createMockInstance({ needsReview: true });
      
      tx._steps.push(
        createMockStep({ order: 1, actionState: ActionState.COMPLETED }),
        createMockStep({
          order: 2,
          actionState: ActionState.PENDING,
          conditionType: "IF_FALSE",
          conditionConfig: {
            type: "simple",
            field: "workflow.context.needsReview",
            operator: "==",
            value: true,
          },
        }),
      );

      await determineNextSteps({ tx, instance });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateCalls = (tx.workflowInstanceStep.update as any).mock.calls;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const skipCall = updateCalls.find((call: any) => 
        call[0].where.id === "step-2" && call[0].data.actionState === ActionState.SKIPPED
      );
      
      expect(skipCall).toBeDefined();
    });
  });

  describe("Compound Conditions", () => {
    it("should handle AND logic correctly", async () => {
      const tx = createMockTx();
      const instance = createMockInstance({ approved: true, amount: 15000 });
      
      tx._steps.push(
        createMockStep({ order: 1, actionState: ActionState.COMPLETED }),
        createMockStep({
          order: 2,
          actionState: ActionState.PENDING,
          conditionType: "IF_TRUE",
          conditionConfig: {
            type: "compound",
            logic: "AND",
            conditions: [
              {
                type: "simple",
                field: "workflow.context.approved",
                operator: "==",
                value: true,
              },
              {
                type: "simple",
                field: "workflow.context.amount",
                operator: ">",
                value: 10000,
              },
            ],
          },
        }),
      );

      const activated = await determineNextSteps({ tx, instance });

      expect(activated).toBe(1);
      expect(tx.workflowInstanceStep.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "step-2" },
          data: expect.objectContaining({
            actionState: ActionState.READY,
          }),
        }),
      );
    });

    it("should handle OR logic correctly", async () => {
      const tx = createMockTx();
      const instance = createMockInstance({ urgent: true, amount: 5000 });
      
      tx._steps.push(
        createMockStep({ order: 1, actionState: ActionState.COMPLETED }),
        createMockStep({
          order: 2,
          actionState: ActionState.PENDING,
          conditionType: "IF_TRUE",
          conditionConfig: {
            type: "compound",
            logic: "OR",
            conditions: [
              {
                type: "simple",
                field: "workflow.context.urgent",
                operator: "==",
                value: true,
              },
              {
                type: "simple",
                field: "workflow.context.amount",
                operator: ">",
                value: 10000,
              },
            ],
          },
        }),
      );

      const activated = await determineNextSteps({ tx, instance });

      expect(activated).toBe(1);
    });
  });

  describe("Error Handling", () => {
    it("should continue evaluation if condition evaluation fails", async () => {
      const tx = createMockTx();
      const instance = createMockInstance();
      
      // Spy on console.error
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      
      tx._steps.push(
        createMockStep({ order: 1, actionState: ActionState.COMPLETED }),
        createMockStep({
          order: 2,
          actionState: ActionState.PENDING,
          conditionType: "IF_TRUE",
          conditionConfig: {
            type: "invalid",  // Invalid condition type
          },
        }),
      );

      const activated = await determineNextSteps({ tx, instance });

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(activated).toBe(0);
      
      consoleErrorSpy.mockRestore();
    });

    it("should warn if condition type exists but conditionConfig is missing", async () => {
      const tx = createMockTx();
      const instance = createMockInstance();
      
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      
      tx._steps.push(
        createMockStep({ order: 1, actionState: ActionState.COMPLETED }),
        createMockStep({
          order: 2,
          actionState: ActionState.PENDING,
          conditionType: "IF_TRUE",
          conditionConfig: null,  // Missing config
        }),
      );

      await determineNextSteps({ tx, instance });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("has conditionType IF_TRUE but no conditionConfig")
      );
      
      consoleWarnSpy.mockRestore();
    });
  });

  describe("Multiple Steps", () => {
    it("should handle branching workflow with multiple conditional steps", async () => {
      const tx = createMockTx();
      const instance = createMockInstance({ approved: true, requiresSignature: false });
      
      tx._steps.push(
        createMockStep({ order: 1, actionState: ActionState.COMPLETED }),
        // Branch 1: Only if approved (depends on step 1 only)
        createMockStep({
          order: 2,
          actionState: ActionState.PENDING,
          conditionType: "IF_TRUE",
          conditionConfig: {
            type: "simple",
            field: "workflow.context.approved",
            operator: "==",
            value: true,
          },
          dependsOn: ["step-1"], // Parallel branch: depends on step 1 only
        }),
        // Branch 2: Only if requires signature (depends on step 1 only)
        createMockStep({
          order: 3,
          actionState: ActionState.PENDING,
          conditionType: "IF_TRUE",
          conditionConfig: {
            type: "simple",
            field: "workflow.context.requiresSignature",
            operator: "==",
            value: true,
          },
          dependsOn: ["step-1"], // Parallel branch: depends on step 1 only
        }),
      );

      await determineNextSteps({ tx, instance });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateCalls = (tx.workflowInstanceStep.update as any).mock.calls;
      
      // Step 2 should be activated (approved=true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activateCall = updateCalls.find((call: any) => 
        call[0].where.id === "step-2" && call[0].data.actionState === ActionState.READY
      );
      expect(activateCall).toBeDefined();
      
      // Step 3 should be skipped (requiresSignature=false)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const skipCall = updateCalls.find((call: any) => 
        call[0].where.id === "step-3" && call[0].data.actionState === ActionState.SKIPPED
      );
      expect(skipCall).toBeDefined();
    });
  });
});
