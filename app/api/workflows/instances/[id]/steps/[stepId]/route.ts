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
} from "@/lib/workflows/service";
import { reindexInstanceSteps } from "@/lib/workflows/instances";
import { WorkflowPermissionError } from "@/lib/workflows/errors";

const updateSchema = z.object({
  title: z.string().trim().min(2).optional(),
  roleScope: z.enum(["ADMIN", "LAWYER", "PARALEGAL", "CLIENT"]).optional(),
  required: z.boolean().optional(),
  actionConfig: z.union([z.record(z.any()), z.array(z.any())]).optional(),
  insertAfterStepId: z.string().nullable().optional(),
});

type Params = { params: { id: string; stepId: string } };

export const PATCH = withApiHandler(
  async (req: NextRequest, { session, params }: Params) => {
    const user = session!.user!;
    const actor = { id: user.id, role: user.role! };
    const payload = updateSchema.parse(await req.json());

    const updated = await prisma.$transaction(async (tx) => {
      const instance = await tx.workflowInstance.findUnique({
        where: { id: params.id },
        select: { id: true, matterId: true, status: true },
      });

      if (!instance) {
        return NextResponse.json({ error: "Workflow instance not found" }, { status: 404 });
      }

      await assertMatterAccess(user, instance.matterId);
      if (user.role !== "ADMIN" && instance.status !== "DRAFT") {
        throw new WorkflowPermissionError("Only admins can modify active workflows");
      }

      const row = await getWorkflowStepOrThrow(tx, params.stepId);
      const step = toStepWithTemplate(row);

      if (step.instanceId !== instance.id) {
        return NextResponse.json({ error: "Step does not belong to instance" }, { status: 400 });
      }

      await ensureActorCanPerform(tx, step, actor);

      let targetOrder = step.order;

      if (payload.insertAfterStepId !== undefined) {
        const steps = await tx.workflowInstanceStep.findMany({
          where: { instanceId: instance.id },
          orderBy: { order: "asc" },
        });

        const filtered = steps.filter((item) => item.id !== step.id);
        const sequence = filtered.map((item) => item.id);

        if (payload.insertAfterStepId) {
          const idx = sequence.findIndex((id) => id === payload.insertAfterStepId);
          if (idx === -1) {
            throw new WorkflowPermissionError("Reference step not found");
          }
          sequence.splice(idx + 1, 0, step.id);
        } else {
          sequence.unshift(step.id);
        }

        for (let order = 0; order < sequence.length; order += 1) {
          const id = sequence[order];
          await tx.workflowInstanceStep.update({
            where: { id },
            data: { order, updatedAt: new Date() },
          });
          if (id === step.id) {
            targetOrder = order;
          }
        }
      }

      const updatedStep = await tx.workflowInstanceStep.update({
        where: { id: step.id },
        data: {
          title: payload.title ?? step.title,
          roleScope: payload.roleScope ?? step.roleScope,
          required: payload.required ?? step.required,
          order: targetOrder,
          actionData:
            payload.actionConfig !== undefined
              ? {
                  ...(step.actionData ?? { config: {}, history: [] }),
                  config: payload.actionConfig,
                }
              : step.actionData,
        },
        include: {
          templateStep: true,
        },
      });

      await reindexInstanceSteps(tx, instance.id);

      return updatedStep;
    });

    if (updated instanceof NextResponse) {
      return updated;
    }

    return NextResponse.json(updated);
  },
);

export const DELETE = withApiHandler(
  async (_req: NextRequest, { session, params }: Params) => {
    const user = session!.user!;

    await prisma.$transaction(async (tx) => {
      const instance = await tx.workflowInstance.findUnique({
        where: { id: params.id },
        select: { id: true, matterId: true, status: true },
      });

      if (!instance) {
        throw new WorkflowPermissionError("Workflow instance not found");
      }

      await assertMatterAccess(user, instance.matterId);

      if (user.role !== "ADMIN") {
        throw new WorkflowPermissionError("Only admins may remove steps");
      }

      await tx.workflowInstanceStep.delete({
        where: { id: params.stepId },
      });

      await reindexInstanceSteps(tx, instance.id);
    });

    return new NextResponse(null, { status: 204 });
  },
);
