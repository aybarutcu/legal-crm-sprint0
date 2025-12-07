import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";
import { taskLinkCreateSchema } from "@/lib/validation/task";
import {
  assertTaskAccess,
  requireTask,
} from "@/app/api/tasks/_helpers";

export const POST = withApiHandler<{ id: string }>(
  async (req: NextRequest, { params, session }) => {
    const user = session!.user!;
    const taskId = params!.id;
    const payload = taskLinkCreateSchema.parse(await req.json());

    const task = await requireTask(taskId, {
      matter: { select: { id: true, ownerId: true } },
      assignee: { select: { id: true } },
    });

    assertTaskAccess(user, task);

    if (payload.documentId) {
      const document = await prisma.document.findUnique({
        where: { id: payload.documentId },
        select: { matterId: true },
      });
      if (!document) {
        return NextResponse.json(
          { error: "Document not found" },
          { status: 404 },
        );
      }
      if (task.matterId && document.matterId && task.matterId !== document.matterId) {
        return NextResponse.json(
          { error: "Document belongs to a different matter" },
          { status: 409 },
        );
      }
    }

    if (payload.eventId) {
      const event = await prisma.event.findUnique({
        where: { id: payload.eventId },
        select: { matterId: true },
      });
      if (!event) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }
      if (task.matterId && event.matterId && task.matterId !== event.matterId) {
        return NextResponse.json(
          { error: "Event belongs to a different matter" },
          { status: 409 },
        );
      }
    }

    const link = await prisma.taskLink.create({
      data: {
        taskId,
        documentId: payload.documentId ?? undefined,
        eventId: payload.eventId ?? undefined,
        url: payload.url ?? undefined,
      },
    });

    await recordAuditLog({
      actorId: user.id,
      action: "TASK_LINK_CREATED",
      entityType: "TaskLink",
      entityId: link.id,
      metadata: {
        taskId,
        documentId: link.documentId,
        eventId: link.eventId,
        url: link.url,
      },
    });

    return NextResponse.json(link, { status: 201 });
  },
);
