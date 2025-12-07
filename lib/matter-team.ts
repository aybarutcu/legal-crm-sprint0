import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

/**
 * Add a user to a matter's team
 */
export async function addMatterTeamMember(params: {
  matterId: string;
  userId: string;
  addedBy: string;
}) {
  const { matterId, userId, addedBy } = params;

  // Get the user to determine their role
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Only lawyers and paralegals can be team members
  if (user.role !== Role.LAWYER && user.role !== Role.PARALEGAL) {
    throw new Error("Only lawyers and paralegals can be added to matter teams");
  }

  // Check if already a member
  const existing = await prisma.matterTeamMember.findUnique({
    where: {
      matterId_userId: {
        matterId,
        userId,
      },
    },
  });

  if (existing) {
    return existing; // Already a member
  }

  // Add the team member
  return await prisma.matterTeamMember.create({
    data: {
      matterId,
      userId,
      role: user.role,
      addedBy,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });
}

/**
 * Remove a user from a matter's team
 */
export async function removeMatterTeamMember(params: {
  matterId: string;
  userId: string;
}) {
  const { matterId, userId } = params;

  await prisma.matterTeamMember.delete({
    where: {
      matterId_userId: {
        matterId,
        userId,
      },
    },
  });
}

/**
 * Get all team members for a matter
 */
export async function getMatterTeamMembers(matterId: string) {
  return await prisma.matterTeamMember.findMany({
    where: { matterId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
        },
      },
    },
    orderBy: { addedAt: "asc" },
  });
}

/**
 * Check if a user is a team member or owner of a matter
 */
export async function isMatterTeamMember(matterId: string, userId: string): Promise<boolean> {
  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    select: {
      ownerId: true,
      teamMembers: {
        where: { userId },
        select: { id: true },
        take: 1,
      },
    },
  });

  return matter?.ownerId === userId || Boolean(matter?.teamMembers && matter.teamMembers.length > 0);
}

/**
 * Sync team members when a matter is created - automatically add the owner as a team member
 */
export async function syncMatterOwnerToTeam(matterId: string) {
  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    select: {
      ownerId: true,
      owner: {
        select: { id: true, role: true },
      },
    },
  });

  if (!matter?.owner) return;

  // Only add if they're a lawyer or paralegal
  if (matter.owner.role !== Role.LAWYER && matter.owner.role !== Role.PARALEGAL) {
    return;
  }

  // Check if already a team member
  const existing = await prisma.matterTeamMember.findUnique({
    where: {
      matterId_userId: {
        matterId,
        userId: matter.owner.id,
      },
    },
  });

  if (existing) return;

  // Add owner as team member
  await prisma.matterTeamMember.create({
    data: {
      matterId,
      userId: matter.owner.id,
      role: matter.owner.role,
      addedBy: matter.owner.id, // Self-added
    },
  });
}
