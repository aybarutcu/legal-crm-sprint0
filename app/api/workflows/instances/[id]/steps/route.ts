import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { assertMatterAccess } from "@/lib/authorization";
import "@/lib/workflows";
import { reindexInstanceSteps } from "@/lib/workflows/instances";
import { WorkflowPermissionError } from "@/lib/workflows/errors";

const addStepSchema = z.object({
  title: z.string().trim().min(2),
  actionType: z.enum([
    "APPROVAL_LAWYER",
    "SIGNATURE_CLIENT",
    "REQUEST_DOC_CLIENT",
    "PAYMENT_CLIENT",
    "CHECKLIST",
    "WRITE_TEXT",
  ]),
  roleScope: z.enum(["ADMIN", "LAWYER", "PARALEGAL", "CLIENT"]),
  required: z.boolean().optional().default(true),
  actionConfig: z.union([z.record(z.any()), z.array(z.any())]).optional().default({}),
  insertAfterStepId: z.string().optional(),
});

type Params = { params: { id: string } };

export const POST = withApiHandler(
  async (req: NextRequest, { session, params }: Params) => {
    const user = session!.user!;
    const payload = addStepSchema.parse(await req.json());

    const result = await prisma.$transaction(async (tx) => {
      const instance = await tx.workflowInstance.findUnique({
        where: { id: params.id },
        include: {
          steps: {
            orderBy: { order: "asc" },
          },
        },
      });

      if (!instance) {
        return NextResponse.json({ error: "Workflow instance not found" }, { status: 404 });
      }

      await assertMatterAccess(user, instance.matterId);

      if (user.role !== "ADMIN" && instance.status !== "DRAFT") {
        throw new WorkflowPermissionError("Only admins can edit active workflows");
      }

      const steps = await tx.workflowInstanceStep.findMany({
        where: { instanceId: instance.id },
        orderBy: { order: "asc" },
      });

      const orderedSteps = steps.sort((a, b) => a.order - b.order);
      const insertIndex = payload.insertAfterStepId
        ? (() => {
            const index = orderedSteps.findIndex((step) => step.id === payload.insertAfterStepId);
            if (index === -1) {
              throw new WorkflowPermissionError("Reference step not found");
            }
            return index + 1;
          })()
        : orderedSteps.length;

      const sequence = orderedSteps.map((step) => step.id);
      sequence.splice(insertIndex, 0, "__NEW__");

      let createdStepId: string | null = null;

      for (let order = 0; order < sequence.length; order += 1) {
        const identifier = sequence[order];
        if (identifier === "__NEW__") {
          const created = await tx.workflowInstanceStep.create({
            data: {
              instanceId: instance.id,
              templateStepId: null,
              order,
              title: payload.title,
              actionType: payload.actionType,
              roleScope: payload.roleScope,
              required: payload.required,
              actionState: order === 0 ? "READY" : "PENDING",
              actionData: {
                config: payload.actionConfig,
                history: [],
              },
            },
          });
          createdStepId = created.id;
        } else {
          await tx.workflowInstanceStep.update({
            where: { id: identifier },
            data: { order, updatedAt: new Date() },
          });
        }
      }

      await reindexInstanceSteps(tx, instance.id);

      // Send notification if the new step is READY (order === 0)
      if (createdStepId) {
        const createdStep = await tx.workflowInstanceStep.findUnique({
          where: { id: createdStepId },
          select: { actionState: true },
        });
        if (createdStep?.actionState === "READY") {
          const { notifyStepReady } = await import("@/lib/workflows/notifications");
          await notifyStepReady(tx, createdStepId).catch((error) => {
            console.error("[Add Step] Notification failed:", error);
          });
        }
      }

      return tx.workflowInstanceStep.findMany({
        where: { instanceId: instance.id },
        orderBy: { order: "asc" },
        include: {
          templateStep: true,
        },
      });
    });

    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.json(result, { status: 201 });
  },
);
