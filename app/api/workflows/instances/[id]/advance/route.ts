import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { assertMatterAccess } from "@/lib/authorization";
import { refreshInstanceStatus } from "@/lib/workflows/service";
import { determineNextSteps } from "@/lib/workflows/runtime";
import { WorkflowNotFoundError } from "@/lib/workflows/errors";

type Params = { params: { id: string } };

export const POST = withApiHandler(
  async (_req: NextRequest, { params, session }: Params) => {
    const user = session!.user!;

    const payload = await prisma.$transaction(async (tx) => {
      const instance = await tx.workflowInstance.findUnique({
        where: { id: params.id },
        select: { id: true, matterId: true },
      });

      if (!instance) {
        throw new WorkflowNotFoundError("Workflow instance not found");
      }

      await assertMatterAccess(user, instance.matterId);

      // Get full instance with contextData for condition evaluation
      const fullInstance = await tx.workflowInstance.findUnique({
        where: { id: instance.id },
      });

      if (!fullInstance) {
        throw new WorkflowNotFoundError("Workflow instance not found");
      }

      // Determine and activate next steps based on conditions
      const promoted = await determineNextSteps({
        tx,
        instance: fullInstance,
      });
      
      await refreshInstanceStatus(tx, instance.id);

      const steps = await tx.workflowInstanceStep.findMany({
        where: { instanceId: instance.id },
        orderBy: { order: "asc" },
      });

      return {
        promoted,
        steps,
      };
    });

    return NextResponse.json(payload);
  },
);
