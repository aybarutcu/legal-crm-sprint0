import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { assertMatterAccess } from "@/lib/authorization";
import "@/lib/workflows";
import {
  claimWorkflowStep,
  ensureActorCanPerform,
  getWorkflowStepOrThrow,
  toStepWithTemplate,
} from "@/lib/workflows/service";
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
        throw new WorkflowPermissionError("Step already claimed by another actor");
      }

      await claimWorkflowStep(tx, step, actor);

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
