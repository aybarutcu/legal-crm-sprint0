import type { Prisma, Role } from "@prisma/client";

export const taskListInclude = {
  assignee: { select: { id: true, name: true, email: true } },
  matter: { select: { id: true, title: true, ownerId: true } },
  _count: {
    select: {
      checklists: true,
      links: true,
    },
  },
} satisfies Prisma.TaskInclude;

export const taskDetailInclude = {
  assignee: { select: { id: true, name: true, email: true } },
  matter: { select: { id: true, title: true, ownerId: true } },
  checklists: {
    orderBy: { order: "asc" },
  },
  links: true,
} satisfies Prisma.TaskInclude;

export function buildTaskAccessFilter(user: { id: string; role?: Role | null }) {
  if (!user.role || user.role === "ADMIN") {
    return {};
  }

  return {
    OR: [
      { assigneeId: user.id },
      { matter: { ownerId: user.id } },
    ],
  } satisfies Prisma.TaskWhereInput;
}

export function buildMatterAccessFilter(user: { id: string; role?: Role | null }) {
  if (!user.role || user.role === "ADMIN") {
    return {};
  }

  return {
    OR: [
      { ownerId: user.id },
      { teamMembers: { some: { userId: user.id } } },
    ],
  } satisfies Prisma.MatterWhereInput;
}

export function buildTaskQueryFilter(
  filters: Partial<{
    q: string;
    matterId: string;
    assigneeId: string;
    status: Prisma.TaskWhereInput["status"];
    priority: Prisma.TaskWhereInput["priority"];
    dueFrom?: Date;
    dueTo?: Date;
  }>,
) {
  const where: Prisma.TaskWhereInput = {};

  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: "insensitive" } },
      { description: { contains: filters.q, mode: "insensitive" } },
    ];
  }

  if (filters.matterId) {
    where.matterId = filters.matterId;
  }

  if (filters.assigneeId) {
    where.assigneeId = filters.assigneeId;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.priority) {
    where.priority = filters.priority;
  }

  if (filters.dueFrom || filters.dueTo) {
    where.dueAt = {};
    if (filters.dueFrom) {
      where.dueAt.gte = filters.dueFrom;
    }
    if (filters.dueTo) {
      where.dueAt.lte = filters.dueTo;
    }
  }

  return where;
}

export function serializeTask<TaskPayload extends Prisma.TaskGetPayload<{ include: typeof taskDetailInclude }>>(task: TaskPayload) {
  return {
    ...task,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    dueAt: task.dueAt ? task.dueAt.toISOString() : null,
    reminderNotifiedAt: task.reminderNotifiedAt
      ? task.reminderNotifiedAt.toISOString()
      : null,
    checklists: task.checklists?.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    links: task.links?.map((link) => ({
      ...link,
      createdAt: link.createdAt.toISOString(),
    })),
  };
}
