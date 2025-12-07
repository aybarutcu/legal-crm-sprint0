import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { assertMatterAccess, assertContactAccess } from "@/lib/authorization";
import { recordAuditLog } from "@/lib/audit";
import "@/lib/workflows";
import {
  ensureActorCanPerform,
  getWorkflowStepOrThrow,
  toStepWithTemplate,
  claimWorkflowStep,
} from "@/lib/workflows/service";
import { startWorkflowStep } from "@/lib/workflows/runtime";
import { WorkflowPermissionError } from "@/lib/workflows/errors";
import { ActionState, WorkflowInstanceStatus } from "@prisma/client";

type Params = { id: string };

export const POST = withApiHandler<Params>(
  async (_req: NextRequest, { params, session }) => {
    const user = session!.user!;
    const actor = { id: user.id, role: user.role! };

    const updatedStep = await prisma.$transaction(async (tx) => {
      const row = await getWorkflowStepOrThrow(tx, params!.id);
      const step = toStepWithTemplate(row);

      if (step.instance.matterId) {
        await assertMatterAccess(user, step.instance.matterId);
      } else if (step.instance.contactId) {
        await assertContactAccess(user, step.instance.contactId);
      }
      await ensureActorCanPerform(tx, step, actor);

      if (step.assignedToId && step.assignedToId !== actor.id) {
        // Allow admins to override assignment for testing/debugging purposes
        if (actor.role !== "ADMIN") {
          throw new WorkflowPermissionError("Step already started by another actor");
        }
        // For admins, unassign the step first, then reassign to admin
        await tx.workflowInstanceStep.update({
          where: { id: step.id },
          data: {
            assignedToId: null,
            updatedAt: new Date(),
          },
        });
      }
      if (!step.assignedToId) {
        await claimWorkflowStep(tx, step, actor);
        step.assignedToId = actor.id;
      }

      const latest = await tx.workflowInstanceStep.findUnique({
        where: { id: step.id },
        include: {
          templateStep: true,
          instance: true,
        },
      });

      let runtimeStep = toStepWithTemplate(latest!);

      const now = new Date();

      if (runtimeStep.instance.status === WorkflowInstanceStatus.CANCELED) {
        await tx.workflowInstance.update({
          where: { id: runtimeStep.instance.id },
          data: {
            status: WorkflowInstanceStatus.ACTIVE,
            updatedAt: now,
          },
        });
        const refreshedInstance = await tx.workflowInstance.findUnique({
          where: { id: runtimeStep.instance.id },
        });
        if (refreshedInstance) {
          runtimeStep.instance.status = refreshedInstance.status;
        }
      }

      if (runtimeStep.actionState === ActionState.SKIPPED) {
        const rawData = runtimeStep.actionData;
        const data =
          rawData && typeof rawData === "object" && !Array.isArray(rawData)
            ? { ...(rawData as Record<string, unknown>) }
            : {};

        if (!("cancellationReason" in data)) {
          throw new WorkflowPermissionError("Skipped steps cannot be restarted");
        }

        data.restartedAt = now.toISOString();

        await tx.workflowInstanceStep.update({
          where: { id: runtimeStep.id },
          data: {
            actionState: ActionState.READY,
            startedAt: null,
            completedAt: null,
            updatedAt: now,
            actionData: data as any,
          },
        });

        const refreshedStep = await tx.workflowInstanceStep.findUnique({
          where: { id: runtimeStep.id },
          include: {
            templateStep: true,
            instance: true,
          },
        });

        runtimeStep = toStepWithTemplate(refreshedStep!);
      }

      await startWorkflowStep({
        tx,
        instance: runtimeStep.instance,
        step: runtimeStep,
        actor,
      });

      // Record audit log for step start
      await recordAuditLog({
        actorId: user.id,
        action: "workflow.step.start",
        entityType: "workflow",
        entityId: runtimeStep.instanceId,
        metadata: {
          matterId: runtimeStep.instance.matterId,
          stepId: runtimeStep.id,
          stepTitle: runtimeStep.title,
          actionType: runtimeStep.actionType,
        },
      });

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
