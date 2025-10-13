import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { assertMatterAccess } from "@/lib/authorization";
import "@/lib/workflows";
import {
  ensureActorCanPerform,
  getWorkflowStepOrThrow,
  toStepWithTemplate,
  claimWorkflowStep,
  advanceInstanceReadySteps,
  refreshInstanceStatus,
} from "@/lib/workflows/service";
import { completeWorkflowStep } from "@/lib/workflows/runtime";
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

      await advanceInstanceReadySteps(tx, runtimeStep.instanceId);
      await refreshInstanceStatus(tx, runtimeStep.instanceId);

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
