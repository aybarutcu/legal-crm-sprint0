import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { assertMatterAccess } from "@/lib/authorization";
import "@/lib/workflows";
import {
  getWorkflowStepOrThrow,
  toStepWithTemplate,
  advanceInstanceReadySteps,
  refreshInstanceStatus,
} from "@/lib/workflows/service";
import { skipWorkflowStep } from "@/lib/workflows/runtime";
import { Role } from "@prisma/client";

const payloadSchema = z.object({
  reason: z.string().trim().optional(),
});

export const POST = withApiHandler<{ id: string }>(
  async (req: NextRequest, context) => {
    const params = await context.params!;
    const session = context.session;
    const user = session!.user!;
    const actor = { id: user.id, role: user.role! };

    // Only admins can skip steps
    if (actor.role !== Role.ADMIN) {
      return NextResponse.json(
        { error: "Only administrators can skip workflow steps" },
        { status: 403 },
      );
    }

    const body = payloadSchema.parse(await req.json().catch(() => ({})));

    const updatedStep = await prisma.$transaction(async (tx) => {
      const row = await getWorkflowStepOrThrow(tx, params.id);
      const step = toStepWithTemplate(row);

      await assertMatterAccess(user, step.instance.matterId);

      const latest = await tx.workflowInstanceStep.findUnique({
        where: { id: step.id },
        include: {
          templateStep: true,
          instance: true,
        },
      });

      const runtimeStep = toStepWithTemplate(latest!);

      // This will validate that the step is not required and throw if it cannot be skipped
      await skipWorkflowStep({
        tx,
        instance: runtimeStep.instance,
        step: runtimeStep,
        actor,
        reason: body.reason,
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
