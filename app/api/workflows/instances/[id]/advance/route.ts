import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { assertMatterAccess, assertContactAccess } from "@/lib/authorization";
import { refreshInstanceStatus } from "@/lib/workflows/service";
import { determineNextSteps } from "@/lib/workflows/runtime";
import { WorkflowNotFoundError } from "@/lib/workflows/errors";

type Params = { id: string };

export const POST = withApiHandler<Params>(
  async (_req: NextRequest, { params, session }) => {
    const user = session!.user!;

    const payload = await prisma.$transaction(async (tx) => {
      const instance = await tx.workflowInstance.findUnique({
        where: { id: params!.id },
        select: { id: true, matterId: true, contactId: true },
      });

      if (!instance) {
        throw new WorkflowNotFoundError("Workflow instance not found");
      }

      if (instance.matterId) {
        await assertMatterAccess(user, instance.matterId);
      }
      if (instance.contactId) {
        await assertContactAccess(user, instance.contactId);
      }

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
      });

      return {
        promoted,
        steps,
      };
    });

    return NextResponse.json(payload);
  },
);
