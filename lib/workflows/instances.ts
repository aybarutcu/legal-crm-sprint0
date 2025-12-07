import type { Prisma, PrismaClient } from "@prisma/client";
import { ActionState, Role, RoleScope, WorkflowInstanceStatus } from "@prisma/client";
import type { WorkflowActor, WorkflowInstanceStepWithTemplate } from "./types";
import { ensureActorCanPerform, getWorkflowStepOrThrow, toStepWithTemplate } from "./service";
import { WorkflowPermissionError } from "./errors";

export type WorkflowInstanceWithSteps = Prisma.WorkflowInstanceGetPayload<{
  include: {
    steps: true;
    template: true;
  };
}>;

export async function loadInstanceWithSteps(
  tx: PrismaClient | Prisma.TransactionClient,
  id: string,
): Promise<WorkflowInstanceWithSteps | null> {
  return tx.workflowInstance.findUnique({
    where: { id },
    include: {
      template: true,
      steps: {
        include: {
          templateStep: true,
        },
      },
    },
  });
}

export function assertInstanceEditable(
  instance: WorkflowInstanceWithSteps,
  actor: WorkflowActor,
): void {
  if (instance.status !== WorkflowInstanceStatus.DRAFT && actor.role !== Role.ADMIN) {
    throw new WorkflowPermissionError("Only draft instances or admins can modify steps");
  }
}

export async function ensureStepEditable(
  tx: PrismaClient | Prisma.TransactionClient,
  stepId: string,
  actor: WorkflowActor,
): Promise<WorkflowInstanceStepWithTemplate> {
  const row = await getWorkflowStepOrThrow(tx, stepId);
  const step = toStepWithTemplate(row);
  await ensureActorCanPerform(tx, step, actor);
  return step;
}

export function seedStepPayload(
  title: string,
  actionType: Prisma.WorkflowInstanceStepCreateInput["actionType"],
  roleScope: RoleScope,
  required: boolean,
  actionConfig: Record<string, unknown>,
  actionState: ActionState = ActionState.PENDING,
): Prisma.WorkflowInstanceStepCreateWithoutInstanceInput {
  return {
    title,
    actionType,
    roleScope,
    required,
    actionState,
    actionData: {
      config: actionConfig,
      history: [],
    } as Prisma.JsonObject,
  };
}
