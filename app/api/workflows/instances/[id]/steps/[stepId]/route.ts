import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { assertMatterAccess, assertContactAccess } from "@/lib/authorization";
import { recordAuditLog } from "@/lib/audit";
import "@/lib/workflows";
import {
  ensureActorCanPerform,
  getWorkflowStepOrThrow,
  toStepWithTemplate,
} from "@/lib/workflows/service";
import { WorkflowPermissionError } from "@/lib/workflows/errors";

const updateSchema = z.object({
  title: z.string().trim().min(2).optional(),
  roleScope: z.enum(["ADMIN", "LAWYER", "PARALEGAL", "CLIENT"]).optional(),
  required: z.boolean().optional(),
  actionConfig: z.union([z.record(z.any()), z.array(z.any())]).optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  assignedToId: z.string().nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
});

export const PATCH = withApiHandler<{ id: string; stepId: string }>(
  async (req: NextRequest, context) => {
    const user = context.session!.user!;
    const actor = { id: user.id, role: user.role! };
    const payload = updateSchema.parse(await req.json());

    const updated = await prisma.$transaction(async (tx) => {
      const instance = await tx.workflowInstance.findUnique({
        where: { id: context.params!.id },
        select: { id: true, matterId: true, contactId: true, status: true },
      });

      if (!instance) {
        return NextResponse.json({ error: "Workflow instance not found" }, { status: 404 });
      }

      if (instance.matterId) {
        await assertMatterAccess(user, instance.matterId);
      } else if (instance.contactId) {
        await assertContactAccess(user, instance.contactId);
      }

      if (user.role !== "ADMIN" && instance.status !== "DRAFT") {
        throw new WorkflowPermissionError("Only admins can modify active workflows");
      }

      const row = await getWorkflowStepOrThrow(tx, context.params!.stepId);
      const step = toStepWithTemplate(row);

      if (step.instanceId !== instance.id) {
        return NextResponse.json({ error: "Step does not belong to instance" }, { status: 400 });
      }

      await ensureActorCanPerform(tx, step, actor);

      const updatedStep = await tx.workflowInstanceStep.update({
        where: { id: step.id },
        data: {
          title: payload.title ?? step.title,
          roleScope: payload.roleScope ?? step.roleScope,
          required: payload.required ?? step.required,
          positionX: payload.positionX ?? step.positionX,
          positionY: payload.positionY ?? step.positionY,
          dueDate: payload.dueDate !== undefined 
            ? (payload.dueDate ? new Date(payload.dueDate) : null)
            : step.dueDate,
          assignedToId: payload.assignedToId !== undefined 
            ? payload.assignedToId 
            : step.assignedToId,
          priority: payload.priority !== undefined
            ? payload.priority
            : step.priority,
          actionData:
            payload.actionConfig !== undefined
              ? ({
                  ...((step.actionData as { config: unknown; history: unknown[] } | null) ?? { config: {}, history: [] }),
                  config: payload.actionConfig,
                } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
              : step.actionData,
        },
        include: {
          templateStep: true,
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Create audit log for metadata changes
      const metadataChanges: Record<string, unknown> = {};
      if (payload.dueDate !== undefined) metadataChanges.dueDate = payload.dueDate;
      if (payload.assignedToId !== undefined) metadataChanges.assignedToId = payload.assignedToId;
      if (payload.priority !== undefined) metadataChanges.priority = payload.priority;

      if (Object.keys(metadataChanges).length > 0 && instance.matterId) {
        await recordAuditLog({
          actorId: user.id,
          action: "workflow.step.update",
          entityType: "matter",
          entityId: instance.matterId,
          metadata: {
            stepId: updatedStep.id,
            stepTitle: updatedStep.title,
            changes: metadataChanges,
          },
        });
      }

      return updatedStep;
    });

    if (updated instanceof NextResponse) {
      return updated;
    }

    return NextResponse.json(updated);
  },
);

export const DELETE = withApiHandler<{ id: string; stepId: string }>(
  async (_req: NextRequest, context) => {
    const user = context.session!.user!;

    await prisma.$transaction(async (tx) => {
      const instance = await tx.workflowInstance.findUnique({
        where: { id: context.params!.id },
        select: { id: true, matterId: true, status: true },
      });

      if (!instance) {
        throw new WorkflowPermissionError("Workflow instance not found");
      }

      if (instance.matterId) {
        await assertMatterAccess(user, instance.matterId);
      }

      if (user.role !== "ADMIN") {
        throw new WorkflowPermissionError("Only admins may remove steps");
      }

      await tx.workflowInstanceStep.delete({
        where: { id: context.params!.stepId },
      });

    });

    return new NextResponse(null, { status: 204 });
  },
);
