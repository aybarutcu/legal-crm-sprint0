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

export const GET = withApiHandler<{ id: string }>(
  async (_req: NextRequest, { params, session }) => {
    const user = session!.user!;
    const resolvedParams = await params;
    const itemId = resolvedParams!.id;

    // Try to find as workflow step first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const workflowStep = (await prisma.workflowInstanceStep.findUnique({
      where: { id: itemId },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        instance: {
          include: {
            matter: { select: { id: true, title: true, ownerId: true } },
            // @ts-expect-error - contact relation exists but Prisma types need refresh
            contact: { select: { id: true, firstName: true, lastName: true, type: true, ownerId: true } },
            template: { select: { id: true, name: true } },
          },
        },
      },
    })) as any;

    if (workflowStep) {
      // Check access: user must be assigned OR be on matter team OR own the contact OR be admin
      const isAssigned = workflowStep.assignedToId === user.id;
      const isAdmin = user.role === "ADMIN";
      
      let hasAccess = isAssigned || isAdmin;
      
      // Check matter team access
      if (workflowStep.instance.matterId && !hasAccess) {
        const isMatterTeamMember = await prisma.matterTeamMember.findFirst({
          where: {
            matterId: workflowStep.instance.matterId,
            userId: user.id,
          },
        });
        hasAccess = !!isMatterTeamMember;
      }
      
      // Check contact ownership access
      if (workflowStep.instance.contactId && !hasAccess) {
        const ownsContact = workflowStep.instance.contact?.ownerId === user.id;
        hasAccess = ownsContact;
      }

      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // Transform to task-like format
      let status: "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELED" = "OPEN";
      if (["READY", "PENDING"].includes(workflowStep.actionState)) status = "OPEN";
      else if (workflowStep.actionState === "IN_PROGRESS") status = "IN_PROGRESS";
      else if (workflowStep.actionState === "COMPLETED") status = "DONE";
      else if (["SKIPPED", "FAILED"].includes(workflowStep.actionState)) status = "CANCELED";

      return NextResponse.json({
        id: workflowStep.id,
        title: workflowStep.title,
        description: workflowStep.notes || `${workflowStep.actionType} action in workflow`,
        dueAt: workflowStep.dueDate?.toISOString() || null,
        priority: workflowStep.priority || "MEDIUM",
        status,
        assignee: workflowStep.assignedTo,
        assigneeId: workflowStep.assignedToId,
        matter: workflowStep.instance.matter,
        matterId: workflowStep.instance.matterId,
        contact: workflowStep.instance.contact,
        contactId: workflowStep.instance.contactId,
        checklists: [],
        links: [],
        itemType: 'WORKFLOW_STEP' as const,
        actionType: workflowStep.actionType,
        actionState: workflowStep.actionState,
        roleScope: workflowStep.roleScope,
        workflowName: workflowStep.instance.template?.name || "Ad-hoc Workflow",
        instanceId: workflowStep.instance.id,
      });
    }

    // Fall back to legacy task
    const task = await requireTask(itemId);
    assertTaskAccess(user, task);

    return NextResponse.json(task);
  },
);

export const PATCH = withApiHandler<{ id: string }>(
  async (req: NextRequest, { params, session }) => {
    const resolvedParams = await params;
    const task = await requireTask(resolvedParams!.id, taskAccessInclude);
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

export const DELETE = withApiHandler<{ id: string }>(
  async (_req: NextRequest, { params, session }) => {
    const resolvedParams = await params;
    const task = await requireTask(resolvedParams!.id, {
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
