import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SessionUser = {
  id: string;
  role?: Role;
};

const baseInclude = {
  matter: { select: { id: true, title: true, ownerId: true } },
  assignee: { select: { id: true, name: true, email: true } },
  checklists: { orderBy: { order: "asc" } },
  links: true,
} satisfies Prisma.TaskInclude;

type IncludeParam =
  | undefined
  | Prisma.TaskInclude;

export async function requireTask<TInclude extends IncludeParam>(
  taskId: string,
  include?: TInclude,
) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: (include ?? baseInclude) as TInclude extends undefined
      ? typeof baseInclude
      : TInclude,
  });

  if (!task) {
    const error = new Error("Not Found");
    // @ts-expect-error propagate status for API handler
    error.status = 404;
    throw error;
  }

  return task as Prisma.TaskGetPayload<{
    include: TInclude extends undefined ? typeof baseInclude : TInclude;
  }>;
}

export function assertTaskAccess(
  user: SessionUser,
  task: {
    assigneeId: string | null;
    matter?: { ownerId: string | null } | null;
  },
) {
  if (!user.role) {
    const error = new Error("Forbidden");
    // @ts-expect-error propagate status
    error.status = 403;
    throw error;
  }

  if (user.role === "ADMIN") {
    return;
  }

  if (task.assigneeId && task.assigneeId === user.id) {
    return;
  }

  if (task.matter?.ownerId && task.matter.ownerId === user.id) {
    return;
  }

  const error = new Error("Forbidden");
  // @ts-expect-error propagate status
  error.status = 403;
  throw error;
}

export const taskAccessInclude = baseInclude;
