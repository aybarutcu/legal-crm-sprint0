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
        teamMembers: {
          select: {
            userId: true,
            user: { select: { id: true, role: true } },
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

  // Add owner if they are a lawyer
  if (matter?.owner && matter.owner.role === Role.LAWYER) {
    lawyerIds.add(matter.owner.id);
  }

  // Add team members based on their roles
  for (const member of matter?.teamMembers ?? []) {
    if (!member.user) continue;
    if (member.user.role === Role.LAWYER) {
      lawyerIds.add(member.user.id);
    }
    if (member.user.role === Role.PARALEGAL) {
      paralegalIds.add(member.user.id);
    }
  }

  return {
    admins: admins.map((user) => user.id),
    lawyers: Array.from(lawyerIds),
    paralegals: Array.from(paralegalIds),
    clients: dedupe([matter?.client?.userId ?? null]),
  };
}

export async function loadContactWorkflowActorSnapshot(
  prisma: PrismaClient | Prisma.TransactionClient,
  contactId: string,
): Promise<WorkflowActorSnapshot> {
  const [admins, contact] = await Promise.all([
    prisma.user.findMany({
      where: { role: Role.ADMIN, isActive: true },
      select: { id: true },
    }),
    prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        ownerId: true,
        owner: { select: { id: true, role: true } },
        userId: true,
        user: { select: { id: true, role: true } },
      },
    }),
  ]);

  const lawyerIds = new Set<string>();
  const paralegalIds = new Set<string>();

  // Add owner if they are a lawyer
  if (contact?.owner && contact.owner.role === Role.LAWYER) {
    lawyerIds.add(contact.owner.id);
  }

  return {
    admins: admins.map((user) => user.id),
    lawyers: Array.from(lawyerIds),
    paralegals: Array.from(paralegalIds),
    clients: dedupe([contact?.userId ?? null]),
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
