/**
 * Document Family Operations
 * 
 * Helper functions to work with document families (all versions of a document grouped by displayName).
 * Operations like move, delete, and rename should affect all versions in the family.
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * Find all versions of a document by displayName within the same matter/contact scope
 */
export async function findDocumentFamily(params: {
  displayName: string;
  matterId?: string | null;
  contactId?: string | null;
  folderId?: string | null;
}) {
  const { displayName, matterId, contactId, folderId } = params;

  const where: Prisma.DocumentWhereInput = {
    displayName,
    deletedAt: null,
    matterId: matterId ?? null,
    contactId: contactId ?? null,
  };

  // Optional: filter by folder if specified
  if (folderId !== undefined) {
    where.folderId = folderId;
  }

  return prisma.document.findMany({
    where,
    orderBy: { version: 'asc' },
    select: {
      id: true,
      filename: true,
      displayName: true,
      version: true,
      storageKey: true,
      folderId: true,
      matterId: true,
      contactId: true,
      uploaderId: true,
      accessScope: true,
      accessMetadata: true,
    },
  });
}

/**
 * Get all document IDs in a family
 */
export async function getDocumentFamilyIds(params: {
  displayName: string;
  matterId?: string | null;
  contactId?: string | null;
  folderId?: string | null;
}): Promise<string[]> {
  const family = await findDocumentFamily(params);
  return family.map(doc => doc.id);
}

/**
 * Find document family by a single document ID (finds all siblings)
 */
export async function findDocumentFamilyById(documentId: string) {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      displayName: true,
      matterId: true,
      contactId: true,
      folderId: true,
    },
  });

  if (!doc) {
    return [];
  }

  return findDocumentFamily({
    displayName: doc.displayName,
    matterId: doc.matterId,
    contactId: doc.contactId,
  });
}

/**
 * Check if a document has multiple versions (is part of a family)
 */
export async function hasMultipleVersions(documentId: string): Promise<boolean> {
  const family = await findDocumentFamilyById(documentId);
  return family.length > 1;
}

/**
 * Get the latest version number in a document family
 */
export async function getLatestVersionInFamily(params: {
  displayName: string;
  matterId?: string | null;
  contactId?: string | null;
}): Promise<number> {
  const family = await findDocumentFamily(params);
  if (family.length === 0) return 0;
  return Math.max(...family.map(doc => doc.version));
}
