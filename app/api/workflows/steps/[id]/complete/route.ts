import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
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
  refreshInstanceStatus,
} from "@/lib/workflows/service";
import { completeWorkflowStep, determineNextSteps } from "@/lib/workflows/runtime";
import { WorkflowPermissionError } from "@/lib/workflows/errors";

const payloadSchema = z.object({
  payload: z.unknown().optional(),
});

type Params = { params: { id: string } };

export const POST = withApiHandler(
  async (req: NextRequest, { params, session }: Params) => {
    const user = session!.user!;
    const actor = { id: user.id, role: user.role! };
    const body = payloadSchema.parse(await req.json().catch(() => ({})));

    const updatedStep = await prisma.$transaction(async (tx) => {
      const row = await getWorkflowStepOrThrow(tx, params.id);
      const step = toStepWithTemplate(row);

      await assertMatterAccess(user, step.instance.matterId);
      await ensureActorCanPerform(tx, step, actor);

      if (step.assignedToId && step.assignedToId !== actor.id) {
        throw new WorkflowPermissionError("Step already claimed by another actor");
      }
      if (!step.assignedToId) {
        await claimWorkflowStep(tx, step, actor);
      }

      const latest = await tx.workflowInstanceStep.findUnique({
        where: { id: step.id },
        include: {
          templateStep: true,
          instance: true,
        },
      });

      const runtimeStep = toStepWithTemplate(latest!);

      await completeWorkflowStep({
        tx,
        instance: runtimeStep.instance,
        step: runtimeStep,
        actor,
        payload: body.payload,
      });

      // Determine and activate next steps based on conditions
      await determineNextSteps({
        tx,
        instance: runtimeStep.instance,
        completedStep: runtimeStep,
      });
      
      await refreshInstanceStatus(tx, runtimeStep.instanceId);

      // Record audit log for step completion
      await recordAuditLog({
        actorId: user.id,
        action: "workflow.step.complete",
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
