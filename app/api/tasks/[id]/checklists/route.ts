import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";
import { taskChecklistCreateSchema } from "@/lib/validation/task";
import {
  assertTaskAccess,
  requireTask,
} from "@/app/api/tasks/_helpers";

export const POST = withApiHandler<{ id: string }>(
  async (req: NextRequest, { params, session }) => {
    const user = session!.user!;
    const taskId = params!.id;
    const task = await requireTask(taskId, {
      assignee: { select: { id: true } },
      matter: { select: { ownerId: true } },
    });

    assertTaskAccess(user, task);

    const payload = taskChecklistCreateSchema.parse(await req.json());

    const lastItem = await prisma.taskChecklist.findFirst({
      where: { taskId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const nextOrder = (lastItem?.order ?? -1) + 1;

    const checklist = await prisma.taskChecklist.create({
      data: {
        taskId,
        title: payload.title,
        order: nextOrder,
      },
    });

    await recordAuditLog({
      actorId: user.id,
      action: "TASK_CHECKLIST_CREATED",
      entityType: "TaskChecklist",
      entityId: checklist.id,
      metadata: {
        taskId,
        title: checklist.title,
      },
    });

    return NextResponse.json(checklist, { status: 201 });
  },
);
