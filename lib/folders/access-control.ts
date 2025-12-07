import { DocumentAccessScope, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface FolderInfo {
  id: string;
  createdById: string;
  accessScope: DocumentAccessScope;
  accessMetadata: Record<string, unknown> | null;
  matterId: string | null;
  contactId: string | null;
  parentFolderId: string | null;
}

export interface AccessContext {
  userId: string;
  userRole: Role;
}

export interface AccessCheckResult {
  hasAccess: boolean;
  reason?: string;
}

/**
 * Check if a user can access a folder
 * Folder access follows same rules as documents with cascading permissions
 */
export async function checkFolderAccess(
  folderInfo: FolderInfo,
  context: AccessContext
): Promise<AccessCheckResult> {
  // 1. Admin override
  if (context.userRole === "ADMIN") {
    return { hasAccess: true };
  }

  // 2. Creator always has access
  if (folderInfo.createdById === context.userId) {
    return { hasAccess: true };
  }

  // 3. Check parent folder access (cascading permissions)
  if (folderInfo.parentFolderId) {
    const parentFolder = await prisma.documentFolder.findUnique({
      where: { id: folderInfo.parentFolderId },
      select: {
        id: true,
        createdById: true,
        accessScope: true,
        accessMetadata: true,
        matterId: true,
        contactId: true,
        parentFolderId: true,
      },
    });

    if (parentFolder) {
      const parentAccess = await checkFolderAccess(parentFolder, context);
      if (!parentAccess.hasAccess) {
        return {
          hasAccess: false,
          reason: "Parent folder access denied",
        };
      }
    }
  }

  // 4. Access scope based checks
  switch (folderInfo.accessScope) {
    case "PUBLIC": {
      // Check matter/contact ownership or team membership
      if (folderInfo.matterId) {
        const matter = await prisma.matter.findUnique({
          where: { id: folderInfo.matterId },
          select: {
            ownerId: true,
            team: { where: { userId: context.userId } },
          },
        });

        if (
          matter &&
          (matter.ownerId === context.userId || matter.team.length > 0)
        ) {
          return { hasAccess: true };
        }
      }

      if (folderInfo.contactId) {
        const contact = await prisma.contact.findUnique({
          where: { id: folderInfo.contactId },
          select: { ownerId: true },
        });

        if (contact && contact.ownerId === context.userId) {
          return { hasAccess: true };
        }
      }

      return {
        hasAccess: false,
        reason: "Not a member of associated matter/contact",
      };
    }

    case "ROLE_BASED": {
      const allowedRoles =
        (folderInfo.accessMetadata?.allowedRoles as string[]) || [];
      if (allowedRoles.includes(context.userRole)) {
        // Still check matter/contact membership
        if (folderInfo.matterId) {
          const matter = await prisma.matter.findUnique({
            where: { id: folderInfo.matterId },
            select: {
              ownerId: true,
              team: { where: { userId: context.userId } },
            },
          });

          if (
            matter &&
            (matter.ownerId === context.userId || matter.team.length > 0)
          ) {
            return { hasAccess: true };
          }
        }

        if (folderInfo.contactId) {
          const contact = await prisma.contact.findUnique({
            where: { id: folderInfo.contactId },
            select: { ownerId: true },
          });

          if (contact && contact.ownerId === context.userId) {
            return { hasAccess: true };
          }
        }

        return {
          hasAccess: false,
          reason: "Not a member of associated matter/contact",
        };
      }

      return {
        hasAccess: false,
        reason: "Role not authorized",
      };
    }

    case "USER_BASED": {
      // Check explicit grants
      const grant = await prisma.folderAccess.findUnique({
        where: {
          folderId_userId: {
            folderId: folderInfo.id,
            userId: context.userId,
          },
        },
      });

      if (grant) {
        return { hasAccess: true };
      }

      return {
        hasAccess: false,
        reason: "Explicit access not granted",
      };
    }

    case "PRIVATE": {
      return {
        hasAccess: false,
        reason: "Folder is private",
      };
    }

    default:
      return {
        hasAccess: false,
        reason: "Unknown access scope",
      };
  }
}

/**
 * Get folder path from root to current folder
 */
export async function getFolderPath(
  folderId: string
): Promise<Array<{ id: string; name: string }>> {
  const path: Array<{ id: string; name: string }> = [];
  let currentId: string | null = folderId;

  while (currentId) {
    const folder = await prisma.documentFolder.findUnique({
      where: { id: currentId },
      select: { id: true, name: true, parentFolderId: true },
    });

    if (!folder) break;

    path.unshift({ id: folder.id, name: folder.name });
    currentId = folder.parentFolderId;
  }

  return path;
}

/**
 * Grant folder access to a user
 */
export async function grantFolderAccess(
  folderId: string,
  userId: string,
  grantedBy: string
): Promise<void> {
  await prisma.folderAccess.create({
    data: {
      folderId,
      userId,
      grantedBy,
    },
  });
}

/**
 * Revoke folder access from a user
 */
export async function revokeFolderAccess(
  folderId: string,
  userId: string
): Promise<void> {
  await prisma.folderAccess.delete({
    where: {
      folderId_userId: {
        folderId,
        userId,
      },
    },
  });
}

/**
 * Get all users with explicit folder access
 */
export async function getFolderAccessGrants(folderId: string) {
  return prisma.folderAccess.findMany({
    where: { folderId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      grantor: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}
