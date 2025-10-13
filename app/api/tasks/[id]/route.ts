import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { recordAuditLog } from "@/lib/audit";
import { taskUpdateSchema } from "@/lib/validation/task";
import { prisma } from "@/lib/prisma";
import {
  assertTaskAccess,
  requireTask,
  taskAccessInclude,
} from "@/app/api/tasks/_helpers";

export const GET = withApiHandler(
  async (_req: NextRequest, { params, session }) => {
    const user = session!.user!;
    const task = await requireTask(params!.id);
    assertTaskAccess(user, task);

    return NextResponse.json(task);
  },
);

export const PATCH = withApiHandler(
  async (req: NextRequest, { params, session }) => {
    const task = await requireTask(params!.id, taskAccessInclude);
    const user = session!.user!;

    assertTaskAccess(user, task);

    const payload = taskUpdateSchema.parse(await req.json());

    if (Object.keys(payload).length === 0) {
      return NextResponse.json(
        { error: "No fields provided" },
        { status: 400 },
      );
    }

    const data: Prisma.TaskUpdateInput = {};
    const changes: Record<string, { before: unknown; after: unknown }> = {};

    if ("title" in payload) {
      data.title = payload.title!;
      changes.title = { before: task.title, after: payload.title };
    }

    if ("description" in payload) {
      data.description = payload.description ?? null;
      changes.description = {
        before: task.description,
        after: payload.description ?? null,
      };
    }

    if ("matterId" in payload) {
      data.matter = payload.matterId
        ? { connect: { id: payload.matterId } }
        : { disconnect: true };
      changes.matterId = {
        before: task.matterId,
        after: payload.matterId ?? null,
      };
    }

    if ("assigneeId" in payload) {
      data.assignee = payload.assigneeId
        ? { connect: { id: payload.assigneeId } }
        : { disconnect: true };
      changes.assigneeId = {
        before: task.assigneeId,
        after: payload.assigneeId ?? null,
      };
    }

    if ("dueAt" in payload) {
      data.dueAt = payload.dueAt ?? null;
      data.reminderNotified = false;
      data.reminderNotifiedAt = null;
      changes.dueAt = {
        before: task.dueAt,
        after: payload.dueAt ?? null,
      };
    }

    if ("priority" in payload) {
      data.priority = payload.priority!;
      changes.priority = {
        before: task.priority,
        after: payload.priority,
      };
    }

    if ("status" in payload) {
      data.status = payload.status!;
      changes.status = {
        before: task.status,
        after: payload.status,
      };
    }

    const updated = await prisma.task.update({
      where: { id: task.id },
      data,
      include: {
        assignee: taskAccessInclude.assignee,
        matter: taskAccessInclude.matter,
        checklists: taskAccessInclude.checklists,
        links: taskAccessInclude.links,
      },
    });

    await recordAuditLog({
      actorId: user.id,
      action: "TASK_UPDATED",
      entityType: "Task",
      entityId: task.id,
      metadata: { changes },
    });

    return NextResponse.json(updated);
  },
);

export const DELETE = withApiHandler(
  async (_req: NextRequest, { params, session }) => {
    const task = await requireTask(params!.id, {
      matter: { select: { ownerId: true } },
    });
    const user = session!.user!;

    assertTaskAccess(user, task);

    await prisma.task.delete({ where: { id: task.id } });

    await recordAuditLog({
      actorId: user.id,
      action: "TASK_DELETED",
      entityType: "Task",
      entityId: task.id,
      metadata: {
        title: task.title,
        matterId: task.matterId,
        assigneeId: task.assigneeId,
      },
    });

    return new NextResponse(null, { status: 204 });
  },
);
