/**
 * Document Access Control
 * 
 * Implements granular permission checking for documents with four access levels:
 * - PUBLIC: Anyone in the matter/contact team can access
 * - ROLE_BASED: Restricted to specific roles (stored in accessMetadata)
 * - USER_BASED: Restricted to specific users (via DocumentAccess grants)
 * - PRIVATE: Only uploader, owner, and admins
 * 
 * Permission Hierarchy:
 * 1. ADMIN users have full access to everything
 * 2. Document uploader has full access to their own documents
 * 3. Matter/Contact owner has full access to all documents in their entities
 * 4. Team members have access based on document's accessScope setting
 */

import { prisma } from "@/lib/prisma";
import { Role, DocumentAccessScope } from "@prisma/client";

export interface AccessCheckContext {
  userId: string;
  userRole: Role;
}

export interface DocumentAccessInfo {
  id: string;
  uploaderId: string;
  accessScope: DocumentAccessScope;
  accessMetadata: Record<string, unknown> | null;
  matterId: string | null;
  contactId: string | null;
}

/**
 * Check if a user has access to a specific document
 */
export async function checkDocumentAccess(
  documentInfo: DocumentAccessInfo,
  context: AccessCheckContext
): Promise<{ hasAccess: boolean; reason?: string }> {
  const { userId, userRole } = context;

  // 1. ADMIN users have full access
  if (userRole === "ADMIN") {
    return { hasAccess: true };
  }

  // 2. Document uploader has full access
  if (documentInfo.uploaderId === userId) {
    return { hasAccess: true };
  }

  // 3. Check if user is matter/contact owner
  if (documentInfo.matterId) {
    const matter = await prisma.matter.findUnique({
      where: { id: documentInfo.matterId },
      select: { ownerId: true },
    });
    if (matter?.ownerId === userId) {
      return { hasAccess: true };
    }
  }

  if (documentInfo.contactId) {
    const contact = await prisma.contact.findUnique({
      where: { id: documentInfo.contactId },
      select: { ownerId: true },
    });
    if (contact?.ownerId === userId) {
      return { hasAccess: true };
    }
  }

  // 4. Check access based on scope
  switch (documentInfo.accessScope) {
    case "PRIVATE":
      return {
        hasAccess: false,
        reason: "This document is private and only accessible to the uploader, owner, and administrators.",
      };

    case "PUBLIC":
      // Check if user is in the matter/contact team
      const isTeamMember = await checkTeamMembership(
        userId,
        documentInfo.matterId,
        documentInfo.contactId
      );
      if (!isTeamMember) {
        return {
          hasAccess: false,
          reason: "You must be a team member to access this document.",
        };
      }
      return { hasAccess: true };

    case "ROLE_BASED":
      // Check if user's role is in the allowed roles
      const allowedRoles = (documentInfo.accessMetadata?.allowedRoles as string[]) ?? [];
      if (!allowedRoles.includes(userRole)) {
        return {
          hasAccess: false,
          reason: `This document is restricted to users with roles: ${allowedRoles.join(", ")}`,
        };
      }
      // Also verify team membership
      const isTeamMemberRole = await checkTeamMembership(
        userId,
        documentInfo.matterId,
        documentInfo.contactId
      );
      if (!isTeamMemberRole) {
        return {
          hasAccess: false,
          reason: "You must be a team member to access this document.",
        };
      }
      return { hasAccess: true };

    case "USER_BASED":
      // Check if user has explicit access grant
      const accessGrant = await prisma.documentAccess.findUnique({
        where: {
          documentId_userId: {
            documentId: documentInfo.id,
            userId: userId,
          },
        },
      });
      if (!accessGrant) {
        return {
          hasAccess: false,
          reason: "This document is restricted to specific users only.",
        };
      }
      return { hasAccess: true };

    default:
      return {
        hasAccess: false,
        reason: "Unknown access scope.",
      };
  }
}

/**
 * Check if user is a member of the matter or contact team
 * Note: Contacts don't have team members - only an owner
 */
async function checkTeamMembership(
  userId: string,
  matterId: string | null,
  contactId: string | null
): Promise<boolean> {
  if (matterId) {
    const teamMember = await prisma.matterTeamMember.findFirst({
      where: {
        matterId: matterId,
        userId: userId,
      },
    });
    return !!teamMember;
  }

  if (contactId) {
    // For contacts, check if user is the owner
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { ownerId: true },
    });
    return contact?.ownerId === userId;
  }

  return false;
}

/**
 * Filter a list of documents to only include those the user has access to
 */
export async function filterAccessibleDocuments<T extends DocumentAccessInfo>(
  documents: T[],
  context: AccessCheckContext
): Promise<T[]> {
  const accessChecks = await Promise.all(
    documents.map(async (doc) => ({
      doc,
      result: await checkDocumentAccess(doc, context),
    }))
  );

  return accessChecks
    .filter(({ result }) => result.hasAccess)
    .map(({ doc }) => doc);
}

/**
 * Grant access to a document for a specific user
 */
export async function grantDocumentAccess(
  documentId: string,
  userId: string,
  grantedBy: string
): Promise<void> {
  await prisma.documentAccess.upsert({
    where: {
      documentId_userId: {
        documentId,
        userId,
      },
    },
    create: {
      documentId,
      userId,
      grantedBy,
    },
    update: {
      grantedBy,
      grantedAt: new Date(),
    },
  });
}

/**
 * Revoke access to a document for a specific user
 */
export async function revokeDocumentAccess(
  documentId: string,
  userId: string
): Promise<void> {
  await prisma.documentAccess.deleteMany({
    where: {
      documentId,
      userId,
    },
  });
}

/**
 * Get all users with explicit access grants for a document
 */
export async function getDocumentAccessGrants(documentId: string) {
  return prisma.documentAccess.findMany({
    where: { documentId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
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
    orderBy: { grantedAt: "desc" },
  });
}

/**
 * Update document access scope and metadata
 */
export async function updateDocumentAccessScope(
  documentId: string,
  accessScope: DocumentAccessScope,
  accessMetadata?: Record<string, unknown>
): Promise<void> {
  await prisma.document.update({
    where: { id: documentId },
    data: {
      accessScope,
      accessMetadata: accessMetadata ?? null,
    },
  });
}
