import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";
import { assertTaskAccess } from "@/app/api/tasks/_helpers";

export const DELETE = withApiHandler(
  async (_req: NextRequest, { params, session }) => {
    const user = session!.user!;
    const linkId = params!.linkId;

    const link = await prisma.taskLink.findUnique({
      where: { id: linkId },
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

    if (!link) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    assertTaskAccess(user, link.task);

    await prisma.taskLink.delete({ where: { id: linkId } });

    await recordAuditLog({
      actorId: user.id,
      action: "TASK_LINK_DELETED",
      entityType: "TaskLink",
      entityId: linkId,
      metadata: {
        taskId: link.task.id,
        documentId: link.documentId,
        eventId: link.eventId,
        url: link.url,
      },
    });

    return new NextResponse(null, { status: 204 });
  },
);
