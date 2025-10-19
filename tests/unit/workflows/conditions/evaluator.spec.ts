/**
 * Unit Tests for ConditionEvaluator
 */

import { describe, it, expect } from "vitest";
import { ConditionEvaluator } from "@/lib/workflows/conditions/evaluator";
import type { ConditionConfig } from "@/lib/workflows/conditions/types";
import type { WorkflowRuntimeContext } from "@/lib/workflows/types";
import { ActionState, ActionType, Role, RoleScope, WorkflowInstanceStatus } from "@prisma/client";

// Mock workflow runtime context builder
function createMockContext(overrides?: Partial<WorkflowRuntimeContext>): WorkflowRuntimeContext {
  return {
    tx: {} as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    instance: {
      id: "instance-1",
      templateId: "template-1",
      matterId: "matter-1",
      templateVersion: 1,
      createdById: "user-1",
      status: WorkflowInstanceStatus.ACTIVE,
      contextData: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides?.instance,
    },
    step: {
      id: "step-1",
      instanceId: "instance-1",
      templateStepId: null,
      order: 1,
      title: "Test Step",
      actionType: ActionType.APPROVAL_LAWYER,
      roleScope: RoleScope.LAWYER,
      required: true,
      actionState: ActionState.READY,
      actionData: null,
      assignedToId: null,
      dueDate: null,
      priority: null,
      notes: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      instance: {} as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      templateStep: null,
      ...overrides?.step,
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    actor: {
      id: "user-1",
      role: Role.LAWYER,
    },
    config: {},
    data: {},
    now: new Date(),
    context: {},
    updateContext: () => {},
    ...overrides,
  };
}

describe("ConditionEvaluator", () => {
  describe("Simple Conditions - Equality", () => {
    it("should evaluate == operator correctly (true)", () => {
      const condition: ConditionConfig = {
        type: "simple",
        field: "workflow.context.approved",
        operator: "==",
        value: true,
      };

      const context = createMockContext({
        context: { approved: true },
      });

      const result = ConditionEvaluator.evaluate(condition, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it("should evaluate == operator correctly (false)", () => {
      const condition: ConditionConfig = {
        type: "simple",
        field: "workflow.context.approved",
        operator: "==",
        value: true,
      };

      const context = createMockContext({
        context: { approved: false },
      });

      const result = ConditionEvaluator.evaluate(condition, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(false);
    });

    it("should evaluate != operator correctly", () => {
      const condition: ConditionConfig = {
        type: "simple",
        field: "workflow.context.status",
        operator: "!=",
        value: "PENDING",
      };

      const context = createMockContext({
        context: { status: "APPROVED" },
      });

      const result = ConditionEvaluator.evaluate(condition, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });
  });

  describe("Simple Conditions - Comparison", () => {
    it("should evaluate > operator correctly", () => {
      const condition: ConditionConfig = {
        type: "simple",
        field: "workflow.context.amount",
        operator: ">",
        value: 1000,
      };

      const context = createMockContext({
        context: { amount: 1500 },
      });

      const result = ConditionEvaluator.evaluate(condition, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it("should evaluate < operator correctly", () => {
      const condition: ConditionConfig = {
        type: "simple",
        field: "workflow.context.amount",
        operator: "<",
        value: 1000,
      };

      const context = createMockContext({
        context: { amount: 500 },
      });

      const result = ConditionEvaluator.evaluate(condition, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it("should evaluate >= operator correctly", () => {
      const condition: ConditionConfig = {
        type: "simple",
        field: "workflow.context.amount",
        operator: ">=",
        value: 1000,
      };

      const context = createMockContext({
        context: { amount: 1000 },
      });

      const result = ConditionEvaluator.evaluate(condition, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it("should evaluate <= operator correctly", () => {
      const condition: ConditionConfig = {
        type: "simple",
        field: "workflow.context.amount",
        operator: "<=",
        value: 1000,
      };

      const context = createMockContext({
        context: { amount: 999 },
      });

      const result = ConditionEvaluator.evaluate(condition, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });
  });

  describe("Simple Conditions - String Operations", () => {
    it("should evaluate contains operator correctly", () => {
      const condition: ConditionConfig = {
        type: "simple",
        field: "workflow.context.description",
        operator: "contains",
        value: "urgent",
      };

      const context = createMockContext({
        context: { description: "This is an urgent matter" },
      });

      const result = ConditionEvaluator.evaluate(condition, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it("should evaluate startsWith operator correctly", () => {
      const condition: ConditionConfig = {
        type: "simple",
        field: "workflow.context.caseNumber",
        operator: "startsWith",
        value: "2025",
      };

      const context = createMockContext({
        context: { caseNumber: "2025-CV-1234" },
      });

      const result = ConditionEvaluator.evaluate(condition, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it("should evaluate endsWith operator correctly", () => {
      const condition: ConditionConfig = {
        type: "simple",
        field: "workflow.context.filename",
        operator: "endsWith",
        value: ".pdf",
      };

      const context = createMockContext({
        context: { filename: "contract.pdf" },
      });

      const result = ConditionEvaluator.evaluate(condition, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });
  });

  describe("Simple Conditions - Array Operations", () => {
    it("should evaluate in operator correctly (true)", () => {
      const condition: ConditionConfig = {
        type: "simple",
        field: "workflow.context.status",
        operator: "in",
        value: ["APPROVED", "COMPLETED", "SIGNED"],
      };

      const context = createMockContext({
        context: { status: "APPROVED" },
      });

      const result = ConditionEvaluator.evaluate(condition, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it("should evaluate in operator correctly (false)", () => {
      const condition: ConditionConfig = {
        type: "simple",
        field: "workflow.context.status",
        operator: "in",
        value: ["APPROVED", "COMPLETED"],
      };

      const context = createMockContext({
        context: { status: "PENDING" },
      });

      const result = ConditionEvaluator.evaluate(condition, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(false);
    });

    it("should evaluate notIn operator correctly", () => {
      const condition: ConditionConfig = {
        type: "simple",
        field: "workflow.context.status",
        operator: "notIn",
        value: ["FAILED", "CANCELED"],
      };

      const context = createMockContext({
        context: { status: "APPROVED" },
      });

      const result = ConditionEvaluator.evaluate(condition, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });
  });

  describe("Simple Conditions - Existence Checks", () => {
    it("should evaluate exists operator correctly (true)", () => {
      const condition: ConditionConfig = {
        type: "simple",
        field: "workflow.context.clientEmail",
        operator: "exists",
      };

      const context = createMockContext({
        context: { clientEmail: "client@example.com" },
      });

      const result = ConditionEvaluator.evaluate(condition, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it("should evaluate exists operator correctly (false)", () => {
      const condition: ConditionConfig = {
        type: "simple",
        field: "workflow.context.clientEmail",
        operator: "exists",
      };

      const context = createMockContext({
        context: {},
      });

      const result = ConditionEvaluator.evaluate(condition, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(false);
    });

    it("should evaluate notExists operator correctly", () => {
      const condition: ConditionConfig = {
        type: "simple",
        field: "workflow.context.optionalField",
        operator: "notExists",
      };

      const context = createMockContext({
        context: {},
      });

      const result = ConditionEvaluator.evaluate(condition, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it("should evaluate isEmpty operator for empty string", () => {
      const condition: ConditionConfig = {
        type: "simple",
        field: "workflow.context.notes",
        operator: "isEmpty",
      };

      const context = createMockContext({
        context: { notes: "" },
      });

      const result = ConditionEvaluator.evaluate(condition, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it("should evaluate isEmpty operator for empty array", () => {
      const condition: ConditionConfig = {
        type: "simple",
        field: "workflow.context.items",
        operator: "isEmpty",
      };

      const context = createMockContext({
        context: { items: [] },
      });

      const result = ConditionEvaluator.evaluate(condition, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it("should evaluate isNotEmpty operator correctly", () => {
      const condition: ConditionConfig = {
        type: "simple",
        field: "workflow.context.notes",
        operator: "isNotEmpty",
      };

      const context = createMockContext({
        context: { notes: "Some notes here" },
      });

      const result = ConditionEvaluator.evaluate(condition, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });
  });

  describe("Compound Conditions", () => {
    it("should evaluate AND logic correctly (all true)", () => {
      const condition: ConditionConfig = {
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
            value: 1000,
          },
        ],
      };

      const context = createMockContext({
        context: { approved: true, amount: 1500 },
      });

      const result = ConditionEvaluator.evaluate(condition, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it("should evaluate AND logic correctly (one false)", () => {
      const condition: ConditionConfig = {
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
            value: 1000,
          },
        ],
      };

      const context = createMockContext({
        context: { approved: true, amount: 500 },
      });

      const result = ConditionEvaluator.evaluate(condition, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(false);
    });

    it("should evaluate OR logic correctly (one true)", () => {
      const condition: ConditionConfig = {
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
      };

      const context = createMockContext({
        context: { urgent: false, amount: 15000 },
      });

      const result = ConditionEvaluator.evaluate(condition, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it("should evaluate OR logic correctly (all false)", () => {
      const condition: ConditionConfig = {
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
      };

      const context = createMockContext({
        context: { urgent: false, amount: 5000 },
      });

      const result = ConditionEvaluator.evaluate(condition, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(false);
    });
  });

  describe("Field Path Resolution", () => {
    it("should resolve workflow.context fields", () => {
      const condition: ConditionConfig = {
        type: "simple",
        field: "workflow.context.nested.value",
        operator: "==",
        value: 42,
      };

      const context = createMockContext({
        context: { nested: { value: 42 } },
      });

      const result = ConditionEvaluator.evaluate(condition, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it("should return undefined for non-existent nested paths", () => {
      const condition: ConditionConfig = {
        type: "simple",
        field: "workflow.context.does.not.exist",
        operator: "notExists",
      };

      const context = createMockContext({
        context: {},
      });

      const result = ConditionEvaluator.evaluate(condition, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });
  });

  describe("Validation", () => {
    it("should fail for invalid condition type", () => {
      const condition = {
        type: "invalid",
        field: "test",
        operator: "==",
        value: true,
      } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

      const context = createMockContext();

      const result = ConditionEvaluator.evaluate(condition, context);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown condition type");
    });

    it("should fail for missing field in simple condition", () => {
      const condition = {
        type: "simple",
        operator: "==",
        value: true,
      } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

      const context = createMockContext();

      const result = ConditionEvaluator.evaluate(condition, context);
      expect(result.success).toBe(false);
      expect(result.error).toContain("must have a 'field'");
    });

    it("should fail for missing value with non-existence operator", () => {
      const condition = {
        type: "simple",
        field: "workflow.context.test",
        operator: "==",
      } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

      const context = createMockContext();

      const result = ConditionEvaluator.evaluate(condition, context);
      expect(result.success).toBe(false);
      expect(result.error).toContain("requires a 'value'");
    });
  });
});
