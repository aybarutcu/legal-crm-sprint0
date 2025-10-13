import type { Prisma, PrismaClient } from "@prisma/client";
import { ActionState, Role, RoleScope, WorkflowInstanceStatus } from "@prisma/client";
import type { WorkflowActor, WorkflowInstanceStepWithTemplate } from "./types";
import { ensureActorCanPerform, getWorkflowStepOrThrow, toStepWithTemplate } from "./service";
import { WorkflowPermissionError } from "./errors";

export type WorkflowInstanceWithSteps = Prisma.WorkflowInstanceGetPayload<{
  include: {
    steps: {
      orderBy: { order: "asc" };
      include: { templateStep: true };
    };
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
        orderBy: { order: "asc" },
        include: {
          templateStep: true,
        },
      },
    },
  });
}

export function normalizeStepOrder(
  steps: Prisma.WorkflowInstanceStepUncheckedCreateWithoutInstanceInput[],
): Prisma.WorkflowInstanceStepUncheckedCreateWithoutInstanceInput[] {
  return steps
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((step, index) => ({
      ...step,
      order: index,
    }));
}

export async function reindexInstanceSteps(
  tx: PrismaClient | Prisma.TransactionClient,
  instanceId: string,
): Promise<void> {
  const steps = await tx.workflowInstanceStep.findMany({
    where: { instanceId },
    orderBy: { order: "asc" },
    select: { id: true, order: true },
  });

  await Promise.all(
    steps.map((step, index) =>
      tx.workflowInstanceStep.update({
        where: { id: step.id },
        data: { order: index, updatedAt: new Date() },
      }),
    ),
  );
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
  order: number,
  title: string,
  actionType: Prisma.WorkflowInstanceStepCreateInput["actionType"],
  roleScope: RoleScope,
  required: boolean,
  actionConfig: Record<string, unknown>,
): Prisma.WorkflowInstanceStepCreateWithoutInstanceInput {
  return {
    order,
    title,
    actionType,
    roleScope,
    required,
    actionState: order === 0 ? ActionState.READY : ActionState.PENDING,
    actionData: {
      config: actionConfig,
      history: [],
    },
  };
}
