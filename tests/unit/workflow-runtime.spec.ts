import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma, WorkflowInstance } from "@prisma/client";
import { ActionState, ActionType, Role, RoleScope } from "@prisma/client";
import { startWorkflowStep, completeWorkflowStep } from "@/lib/workflows/runtime";
import { registerDefaultWorkflowHandlers } from "@/lib/workflows/handlers";
import type { WorkflowInstanceStepWithTemplate } from "@/lib/workflows/types";

describe("workflow runtime", () => {
  let now: Date;
  let instance: WorkflowInstance;
  let step: WorkflowInstanceStepWithTemplate;
  let tx: {
    workflowInstanceStep: {
      update: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    registerDefaultWorkflowHandlers();
    now = new Date("2024-01-01T12:00:00.000Z");
    instance = {
      id: "instance-1",
      templateId: "template-1",
      matterId: "matter-1",
      templateVersion: 1,
      createdById: "admin-1",
      status: "ACTIVE" as WorkflowInstance["status"],
      createdAt: now,
      updatedAt: now,
    } as WorkflowInstance;

    step = {
      id: "step-1",
      instanceId: instance.id,
      templateStepId: "tmpl-step-1",
      order: 0,
      title: "Checklist",
      actionType: ActionType.CHECKLIST,
      roleScope: RoleScope.ADMIN,
      required: true,
      actionState: ActionState.READY,
      actionData: null,
      assignedToId: null,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      templateStep: {
        actionConfig: { items: ["Task"] },
        roleScope: RoleScope.ADMIN,
        actionType: ActionType.CHECKLIST,
        required: true,
      },
    } satisfies WorkflowInstanceStepWithTemplate;

    tx = {
      workflowInstanceStep: {
        update: vi.fn(async ({ data }) => ({ ...step, ...data })),
      },
    };
  });

  it("transitions from READY to IN_PROGRESS and persists state", async () => {
    const txClient = tx as unknown as Prisma.TransactionClient;
    const result = await startWorkflowStep({
      tx: txClient,
      instance,
      step,
      actor: { id: "admin-1", role: Role.ADMIN },
      now,
    });

    expect(result).toBe(ActionState.IN_PROGRESS);
    expect(tx.workflowInstanceStep.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actionState: ActionState.IN_PROGRESS }),
      }),
    );

    step.actionState = ActionState.IN_PROGRESS;

    const completeResult = await completeWorkflowStep({
      tx: txClient,
      instance,
      step,
      actor: { id: "admin-1", role: Role.ADMIN },
      now,
    });

    expect(completeResult).toBe(ActionState.COMPLETED);
    expect(tx.workflowInstanceStep.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actionState: ActionState.COMPLETED }),
      }),
    );
  });
});
