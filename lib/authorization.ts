import { Session } from "next-auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

class NotAuthorizedError extends Error {
  constructor(message = "Not Authorized") {
    super(message);
    this.name = "NotAuthorizedError";
  }
}

export async function requireAdmin(session: Session | null | undefined): Promise<void> {
  if (session?.user?.role !== Role.ADMIN) {
    throw new NotAuthorizedError();
  }
}

export async function assertMatterAccess(user: { id: string; role?: Role }, matterId: string): Promise<void> {
  if (user.role === Role.ADMIN) {
    return;
  }

  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    select: { 
      ownerId: true,
      teamMembers: {
        where: { userId: user.id },
        select: { id: true },
        take: 1,
      },
    },
  });

  // Allow access if user is the matter owner OR is a team member
  const hasAccess = matter?.ownerId === user.id || (matter?.teamMembers && matter.teamMembers.length > 0);
  
  if (!hasAccess) {
    throw new NotAuthorizedError("Matter access denied");
  }
}

export async function assertContactAccess(user: { id: string; role?: Role }, contactId: string): Promise<void> {
  if (user.role === Role.ADMIN) {
    return;
  }

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { 
      ownerId: true,
      userId: true,
    },
  });

  // Allow access if user is the contact owner OR the contact is linked to the user
  const hasAccess = contact?.ownerId === user.id || contact?.userId === user.id;
  
  if (!hasAccess) {
    throw new NotAuthorizedError("Contact access denied");
  }
}

export function isAdmin(role: Role | undefined): boolean {
  return role === Role.ADMIN;
}

export function assertCanModifyResource(options: {
  userRole?: Role;
  userId: string;
  resourceOwnerId?: string | null;
}): void {
  // Admins can modify any resource
  if (options.userRole === Role.ADMIN) {
    return;
  }
  // Non-admins must be the owner of the resource
  if (!options.resourceOwnerId || options.resourceOwnerId !== options.userId) {
    throw new NotAuthorizedError("Forbidden");
  }
}
