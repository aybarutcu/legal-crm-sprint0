import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

const TASK_ENTITY_TYPES = ["Task", "TaskChecklist", "TaskLink"] as const;

export const GET = withApiHandler(async (_req: NextRequest) => {
  const logs = await prisma.auditLog.findMany({
    where: {
      entityType: { in: TASK_ENTITY_TYPES },
    },
    include: {
      actor: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const payload = logs.map((log) => ({
    id: log.id,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    createdAt: log.createdAt.toISOString(),
    metadata: log.metadata ?? null,
    actor: log.actor
      ? {
          id: log.actor.id,
          name: log.actor.name,
          email: log.actor.email,
        }
      : null,
  }));

  return NextResponse.json(payload);
});
