import type { Prisma, PrismaClient } from "@prisma/client";
import { ActionState } from "@prisma/client";
import type { WorkflowActor, WorkflowActorSnapshot, WorkflowInstanceStepWithTemplate } from "./types";
import { canPerformAction } from "./permissions";
import { loadWorkflowActorSnapshot, loadContactWorkflowActorSnapshot } from "./roles";
import { WorkflowNotFoundError, WorkflowPermissionError } from "./errors";
import { assertTransition } from "./state-machine";
import { WorkflowMetrics } from "./observability";
import type { WorkflowActionGuardOptions } from "./types";

export type PrismaClientOrTransaction = PrismaClient | Prisma.TransactionClient;

type StepWithInstance = Prisma.WorkflowInstanceStepGetPayload<{
  include: {
    templateStep: true;
    instance: true;
  };
}>;

export function toStepWithTemplate(step: StepWithInstance): WorkflowInstanceStepWithTemplate {
  return step as unknown as WorkflowInstanceStepWithTemplate;
}

export async function getWorkflowStepOrThrow(
  tx: PrismaClientOrTransaction,
  stepId: string,
): Promise<StepWithInstance> {
  const step = await tx.workflowInstanceStep.findUnique({
    where: { id: stepId },
    include: {
      templateStep: true,
      instance: true,
    },
  });

  if (!step) {
    throw new WorkflowNotFoundError("Workflow step not found");
  }

  return step;
}

export async function ensureActorCanPerform(
  tx: PrismaClientOrTransaction,
  step: WorkflowInstanceStepWithTemplate,
  actor: WorkflowActor,
): Promise<WorkflowActorSnapshot> {
  // Check if this is a matter workflow or contact workflow
  if (step.instance.matterId) {
    // Matter workflow - use existing logic
    const snapshot = await loadWorkflowActorSnapshot(tx, step.instance.matterId);
    const allowed = canPerformAction({
      actor,
      step,
      snapshot,
    });
    if (!allowed.canPerform) {
      throw new WorkflowPermissionError(allowed.reason ?? "Actor cannot perform this action");
    }
    return snapshot;
  } else if (step.instance.contactId) {
    // Contact workflow - check contact access and load contact actor snapshot
    // Note: We need to check contact access at the API level, not here
    // This function focuses on workflow permissions, not entity access
    const snapshot = await loadContactWorkflowActorSnapshot(tx, step.instance.contactId);
    const allowed = canPerformAction({
      actor,
      step,
      snapshot,
    });
    if (!allowed.canPerform) {
      throw new WorkflowPermissionError(allowed.reason ?? "Actor cannot perform this action");
    }
    return snapshot;
  } else {
    throw new WorkflowPermissionError("Workflow instance must be associated with either a matter or contact");
  }
}

export async function setStepState(
  tx: PrismaClientOrTransaction,
  step: WorkflowInstanceStepWithTemplate,
  targetState: ActionState,
  options?: WorkflowActionGuardOptions,
): Promise<void> {
  assertTransition(step.actionState, targetState, options);
  await tx.workflowInstanceStep.update({
    where: { id: step.id },
    data: {
      actionState: targetState,
      updatedAt: new Date(),
    },
  });
}

export async function claimWorkflowStep(
  tx: PrismaClientOrTransaction,
  step: WorkflowInstanceStepWithTemplate,
  actor: WorkflowActor,
): Promise<void> {
  if (step.assignedToId && step.assignedToId !== actor.id) {
    throw new WorkflowPermissionError("Step already claimed by another user");
  }

  await tx.workflowInstanceStep.update({
    where: { id: step.id },
    data: {
      assignedToId: actor.id,
      updatedAt: new Date(),
    },
  });
  
  // Record claim metric
  WorkflowMetrics.recordStepClaim(step.actionType);
}

export async function advanceInstanceReadySteps(
  tx: PrismaClientOrTransaction,
  instanceId: string,
): Promise<number> {
  const steps = await tx.workflowInstanceStep.findMany({
    where: { instanceId },
  });

  const firstPending = steps.find((item) => item.actionState === ActionState.PENDING);
  if (!firstPending) {
    return 0;
  }

  await tx.workflowInstanceStep.update({
    where: { id: firstPending.id },
    data: {
      actionState: ActionState.READY,
      updatedAt: new Date(),
    },
  });

  // Record advancement metric
  WorkflowMetrics.recordStepAdvanced(firstPending.actionType);
  WorkflowMetrics.recordTransition(firstPending.actionType, ActionState.PENDING, ActionState.READY);

  // Send notification for newly READY step
  // Import dynamically to avoid circular dependencies
  const { notifyStepReady } = await import("./notifications");
  await notifyStepReady(tx, firstPending.id);

  return 1;
}

export async function refreshInstanceStatus(
  tx: PrismaClientOrTransaction,
  instanceId: string,
): Promise<void> {
  const steps = await tx.workflowInstanceStep.findMany({
    where: { instanceId },
    select: { actionState: true },
  });

  if (steps.length === 0) {
    return;
  }

  const allComplete = steps.every((item) =>
    item.actionState === ActionState.COMPLETED || item.actionState === ActionState.SKIPPED,
  );

  if (allComplete) {
    await tx.workflowInstance.update({
      where: { id: instanceId },
      data: {
        status: "COMPLETED",
        updatedAt: new Date(),
      },
    });
  }
}
