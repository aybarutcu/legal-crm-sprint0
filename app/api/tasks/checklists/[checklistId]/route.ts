import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";
import { taskChecklistUpdateSchema } from "@/lib/validation/task";
import { assertTaskAccess } from "@/app/api/tasks/_helpers";

export const PATCH = withApiHandler<{ checklistId: string }>(
  async (req: NextRequest, { params, session }) => {
    const user = session!.user!;
    const checklistId = params!.checklistId;
    const payload = taskChecklistUpdateSchema.parse(await req.json());

    if (Object.keys(payload).length === 0) {
      return NextResponse.json(
        { error: "No fields provided" },
        { status: 400 },
      );
    }

    const checklist = await prisma.taskChecklist.findUnique({
      where: { id: checklistId },
      include: {
        task: {
          select: {
            id: true,
            assigneeId: true,
            matter: { select: { ownerId: true } },
          },
        },
      },
    });

    if (!checklist) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    assertTaskAccess(user, checklist.task);

    const data: {
      title?: string;
      done?: boolean;
      order?: number;
    } = {};
    const changes: Record<string, { before: unknown; after: unknown }> = {};

    if ("title" in payload) {
      data.title = payload.title!;
      changes.title = {
        before: checklist.title,
        after: payload.title,
      };
    }

    if ("done" in payload) {
      data.done = payload.done!;
      changes.done = {
        before: checklist.done,
        after: payload.done,
      };
    }

    if ("order" in payload) {
      data.order = payload.order!;
      changes.order = {
        before: checklist.order,
        after: payload.order,
      };
    }

    const updated = await prisma.taskChecklist.update({
      where: { id: checklistId },
      data,
    });

    await recordAuditLog({
      actorId: user.id,
      action: "TASK_CHECKLIST_UPDATED",
      entityType: "TaskChecklist",
      entityId: checklistId,
      metadata: { changes, taskId: checklist.task.id },
    });

    return NextResponse.json(updated);
  },
);

export const DELETE = withApiHandler<{ checklistId: string }>(
  async (_req: NextRequest, { params, session }) => {
    const user = session!.user!;
    const checklistId = params!.checklistId;

    const checklist = await prisma.taskChecklist.findUnique({
      where: { id: checklistId },
      include: {
        task: {
          select: {
            id: true,
            assigneeId: true,
            matter: { select: { ownerId: true } },
          },
        },
      },
    });

    if (!checklist) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    assertTaskAccess(user, checklist.task);

    await prisma.taskChecklist.delete({ where: { id: checklistId } });

    await recordAuditLog({
      actorId: user.id,
      action: "TASK_CHECKLIST_DELETED",
      entityType: "TaskChecklist",
      entityId: checklistId,
      metadata: {
        taskId: checklist.task.id,
        title: checklist.title,
      },
    });

    return new NextResponse(null, { status: 204 });
  },
);
