import { Role, RoleScope } from "@prisma/client";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { WorkflowActorSnapshot } from "./types";

function dedupe(ids: Array<string | null | undefined>): string[] {
  return Array.from(new Set(ids.filter((value): value is string => Boolean(value))));
}

export async function loadWorkflowActorSnapshot(
  prisma: PrismaClient | Prisma.TransactionClient,
  matterId: string,
): Promise<WorkflowActorSnapshot> {
  const [admins, matter] = await Promise.all([
    prisma.user.findMany({
      where: { role: Role.ADMIN, isActive: true },
      select: { id: true },
    }),
    prisma.matter.findUnique({
      where: { id: matterId },
      select: {
        ownerId: true,
        owner: { select: { id: true, role: true } },
        tasks: {
          select: {
            assigneeId: true,
            assignee: { select: { id: true, role: true } },
          },
        },
        client: {
          select: {
            userId: true,
          },
        },
      },
    }),
  ]);

  const lawyerIds = new Set<string>();
  const paralegalIds = new Set<string>();

  if (matter?.owner && matter.owner.role === Role.LAWYER) {
    lawyerIds.add(matter.owner.id);
  }

  for (const task of matter?.tasks ?? []) {
    if (!task.assignee) continue;
    if (task.assignee.role === Role.LAWYER) {
      lawyerIds.add(task.assignee.id);
    }
    if (task.assignee.role === Role.PARALEGAL) {
      paralegalIds.add(task.assignee.id);
    }
  }

  return {
    admins: admins.map((user) => user.id),
    lawyers: Array.from(lawyerIds),
    paralegals: Array.from(paralegalIds),
    clients: dedupe([matter?.client?.userId ?? null]),
  };
}

export function resolveEligibleActorIds(
  roleScope: RoleScope,
  snapshot: WorkflowActorSnapshot,
): string[] {
  switch (roleScope) {
    case RoleScope.ADMIN:
      return snapshot.admins;
    case RoleScope.LAWYER:
      return snapshot.lawyers;
    case RoleScope.PARALEGAL:
      return snapshot.paralegals;
    case RoleScope.CLIENT:
      return snapshot.clients;
    default:
      return [];
  }
}
