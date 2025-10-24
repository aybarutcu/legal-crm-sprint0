import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { assertMatterAccess } from "@/lib/authorization";
import { ActionState, Role, WorkflowInstanceStatus } from "@prisma/client";

export const GET = withApiHandler<{ id: string }>(
  async (_req: NextRequest, { params, session }) => {
    const user = session!.user!;
    const instance = await prisma.workflowInstance.findUnique({
      where: { id: params!.id },
      include: {
        template: { select: { name: true, contextSchema: true } },
        matter: { select: { id: true, title: true } },
        createdBy: { select: { name: true } },
        steps: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (instance) {
      await assertMatterAccess(user, instance.matterId);
    }

    return NextResponse.json(instance);
  },
);

export const DELETE = withApiHandler<{ id: string }>(
  async (req: NextRequest, { params, session }) => {
    const user = session!.user!;
    let cancellationReason: string | undefined;

    if (req.headers.get("content-type")?.includes("application/json")) {
      try {
        const body = await req.json();
        if (typeof body?.cancellationReason === "string" && body.cancellationReason.trim().length > 0) {
          cancellationReason = body.cancellationReason.trim();
        }
      } catch {
        // ignore malformed body; fall back to default reason
      }
    }

    const instance = await prisma.workflowInstance.findUnique({
      where: { id: params!.id },
      select: { id: true, matterId: true },
    });

    if (!instance) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    // Only ADMIN or LAWYER can remove workflow instances
    if (user.role !== Role.ADMIN && user.role !== Role.LAWYER) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Ensure the user has access to the matter (ADMIN passes; owner required otherwise)
    await assertMatterAccess(user, instance.matterId);

    const steps = await prisma.workflowInstanceStep.findMany({
      where: { instanceId: instance.id },
      select: {
        id: true,
        actionState: true,
        actionData: true,
        startedAt: true,
      },
      orderBy: { order: "asc" },
    });

    const hasStartedSteps = steps.some(
      (step) =>
        step.startedAt !== null ||
        [ActionState.IN_PROGRESS, ActionState.COMPLETED, ActionState.FAILED, ActionState.SKIPPED].includes(
          step.actionState,
        ),
    );

    if (!hasStartedSteps) {
      await prisma.workflowInstance.delete({
        where: { id: instance.id },
      });

      return NextResponse.json({ success: true, deleted: true });
    }

    const now = new Date();

    const reasonText = cancellationReason ?? "Workflow cancelled by user";

    const cancellableStates = [
      ActionState.PENDING,
      ActionState.READY,
      ActionState.BLOCKED,
      ActionState.IN_PROGRESS,
      ActionState.SKIPPED,
    ];

    await prisma.$transaction(async (tx) => {
      await tx.workflowInstance.update({
        where: { id: instance.id },
        data: {
          status: WorkflowInstanceStatus.CANCELED,
          updatedAt: now,
        },
      });

      for (const step of steps) {
        if (!cancellableStates.includes(step.actionState)) {
          continue;
        }

        const actionData =
          step.actionData && typeof step.actionData === "object" && !Array.isArray(step.actionData)
            ? { ...(step.actionData as Record<string, unknown>) }
            : {};

        actionData.cancellationReason = reasonText;
        actionData.reason = actionData.reason ?? reasonText;

        await tx.workflowInstanceStep.update({
          where: { id: step.id },
          data: {
            actionState: ActionState.SKIPPED,
            actionData,
            completedAt: now,
            updatedAt: now,
          },
        });
      }
    });

    return NextResponse.json({ success: true, cancelled: true });
  },
);
