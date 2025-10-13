import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { assertMatterAccess } from "@/lib/authorization";
import "@/lib/workflows";
import {
  getWorkflowStepOrThrow,
  toStepWithTemplate,
  setStepState,
  advanceInstanceReadySteps,
  refreshInstanceStatus,
} from "@/lib/workflows/service";
import { ActionState, Role } from "@prisma/client";

type Params = { params: { id: string } };

export const POST = withApiHandler(
  async (_req: NextRequest, { params, session }: Params) => {
    const user = session!.user!;

    if (user.role !== Role.ADMIN) {
      return NextResponse.json({ error: "Only admins may skip steps" }, { status: 403 });
    }

    const updatedStep = await prisma.$transaction(async (tx) => {
      const row = await getWorkflowStepOrThrow(tx, params.id);
      const step = toStepWithTemplate(row);

      await assertMatterAccess(user, step.instance.matterId);

      await setStepState(tx, step, ActionState.SKIPPED, {
        actor: { id: user.id, role: user.role! },
      });
      await advanceInstanceReadySteps(tx, step.instanceId);
      await refreshInstanceStatus(tx, step.instanceId);

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
