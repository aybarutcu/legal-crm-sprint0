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
  claimWorkflowStep,
  refreshInstanceStatus,
} from "@/lib/workflows/service";
import { completeWorkflowStep, determineNextSteps } from "@/lib/workflows/runtime";
import { WorkflowPermissionError } from "@/lib/workflows/errors";

const payloadSchema = z.object({
  payload: z.unknown().optional(),
});

type Params = { id: string };

export const POST = withApiHandler<Params>(
  async (req: NextRequest, { params, session }) => {
    const user = session!.user!;
    const actor = { id: user.id, role: user.role! };
    const body = payloadSchema.parse(await req.json().catch(() => ({})));

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
          throw new WorkflowPermissionError("Step already claimed by another actor");
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
      }

      const latest = await tx.workflowInstanceStep.findUnique({
        where: { id: step.id },
        include: {
          templateStep: true,
          instance: true,
        },
      });

      const runtimeStep = toStepWithTemplate(latest!);

      await completeWorkflowStep({
        tx,
        instance: runtimeStep.instance,
        step: runtimeStep,
        actor,
        payload: body.payload,
      });

      const branchDecision =
        runtimeStep.actionType === "APPROVAL" &&
        body.payload &&
        typeof body.payload === "object" &&
        "approved" in (body.payload as Record<string, unknown>)
          ? Boolean((body.payload as { approved?: boolean }).approved)
          : undefined;

      if (typeof branchDecision === "boolean") {
        // TODO: Implement approval branch transitions
        // await resolveApprovalBranchTransitions({
        //   tx,
        //   instance: runtimeStep.instance,
        //   completedStep: runtimeStep,
        //   decision: branchDecision,
        // });
      }

      // Determine and activate next steps based on conditions
      await determineNextSteps({
        tx,
        instance: runtimeStep.instance,
        completedStep: runtimeStep,
      });
      
      await refreshInstanceStatus(tx, runtimeStep.instanceId);

      // Record audit log for step completion
      await recordAuditLog({
        actorId: user.id,
        action: "workflow.step.complete",
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
