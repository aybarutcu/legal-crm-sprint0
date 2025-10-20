import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { assertMatterAccess } from "@/lib/authorization";
import { recordAuditLog } from "@/lib/audit";
import "@/lib/workflows";
import {
  ensureActorCanPerform,
  getWorkflowStepOrThrow,
  toStepWithTemplate,
  claimWorkflowStep,
} from "@/lib/workflows/service";
import { startWorkflowStep } from "@/lib/workflows/runtime";
import { WorkflowPermissionError } from "@/lib/workflows/errors";

type Params = { params: { id: string } };

export const POST = withApiHandler(
  async (_req: NextRequest, { params, session }: Params) => {
    const user = session!.user!;
    const actor = { id: user.id, role: user.role! };

    const updatedStep = await prisma.$transaction(async (tx) => {
      const row = await getWorkflowStepOrThrow(tx, params.id);
      const step = toStepWithTemplate(row);

      await assertMatterAccess(user, step.instance.matterId);
      await ensureActorCanPerform(tx, step, actor);

      if (step.assignedToId && step.assignedToId !== actor.id) {
        throw new WorkflowPermissionError("Step already started by another actor");
      }
      if (!step.assignedToId) {
        await claimWorkflowStep(tx, step, actor);
        step.assignedToId = actor.id;
      }

      const latest = await tx.workflowInstanceStep.findUnique({
        where: { id: step.id },
        include: {
          templateStep: true,
          instance: true,
        },
      });

      const runtimeStep = toStepWithTemplate(latest!);
      await startWorkflowStep({
        tx,
        instance: runtimeStep.instance,
        step: runtimeStep,
        actor,
      });

      // Record audit log for step start
      await recordAuditLog({
        actorId: user.id,
        action: "workflow.step.start",
        entityType: "workflow",
        entityId: runtimeStep.instanceId,
        metadata: {
          matterId: runtimeStep.instance.matterId,
          stepId: runtimeStep.id,
          stepTitle: runtimeStep.title,
          stepOrder: runtimeStep.order,
          actionType: runtimeStep.actionType,
        },
      });

      return tx.workflowInstanceStep.findUnique({
        where: { id: step.id },
        include: {
          templateStep: true,
          instance: true,
        },
      });
    });

    return NextResponse.json(updatedStep);
  },
);
