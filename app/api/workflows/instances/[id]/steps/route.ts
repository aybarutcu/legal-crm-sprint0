import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { assertMatterAccess, assertContactAccess } from "@/lib/authorization";
import { WorkflowPermissionError } from "@/lib/workflows/errors";

const addStepSchema = z.object({
  title: z.string().trim().min(2),
  actionType: z.enum([
    "APPROVAL",
    "SIGNATURE",
    "REQUEST_DOC",
    "PAYMENT",
    "CHECKLIST",
    "WRITE_TEXT",
  ]),
  roleScope: z.enum(["ADMIN", "LAWYER", "PARALEGAL", "CLIENT"]),
  required: z.boolean().optional().default(true),
  actionConfig: z.union([z.record(z.any()), z.array(z.any())]).optional().default({}),
});

type Params = { params: { id: string } };

export const POST = withApiHandler<{ id: string }>(
  async (req: NextRequest, context) => {
    const user = context.session!.user!;
    const payload = addStepSchema.parse(await req.json());

    const result = await prisma.$transaction(async (tx) => {
      const instance = await tx.workflowInstance.findUnique({
        where: { id: context.params!.id },
        include: {
          steps: true,
        },
      });

      if (!instance) {
        return NextResponse.json({ error: "Workflow instance not found" }, { status: 404 });
      }

      if (instance.matterId) {
        await assertMatterAccess(user, instance.matterId);
      }
      if (instance.contactId) {
        await assertContactAccess(user, instance.contactId);
      }

      if (user.role !== "ADMIN" && instance.status !== "DRAFT") {
        throw new WorkflowPermissionError("Only admins can edit active workflows");
      }

      // Create the new step
      const created = await tx.workflowInstanceStep.create({
        data: {
          instanceId: instance.id,
          templateStepId: null,
          title: payload.title,
          actionType: payload.actionType,
          roleScope: payload.roleScope,
          required: payload.required,
          actionState: "PENDING", // New steps start as PENDING
          actionData: {
            config: payload.actionConfig,
            history: [],
          },
          // Set default position
          positionX: 100,
          positionY: 100 + (instance.steps.length * 150),
        },
      });

      return tx.workflowInstanceStep.findMany({
        where: { instanceId: instance.id },
        include: {
          templateStep: true,
        },
        orderBy: { createdAt: "asc" },
      });
    });

    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.json(result, { status: 201 });
  },
);
