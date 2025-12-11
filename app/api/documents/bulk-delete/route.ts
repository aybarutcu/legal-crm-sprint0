import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { recordAuditLog } from "@/lib/audit";
import { checkDocumentAccess } from "@/lib/documents/access-control";
import { findDocumentFamilyById } from "@/lib/documents/family";
import { deleteObject } from "@/lib/storage";
import { z } from "zod";

const bulkDeleteSchema = z.object({
  documentIds: z.array(z.string()).min(1).max(100), // Max 100 documents at once
});

export const POST = withApiHandler(
  async (req, { session }) => {
    const user = session!.user;
    if (!user?.id || !user?.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const body = await req.json();
    const { documentIds } = bulkDeleteSchema.parse(body);

    // Fetch all documents
    const documents = await prisma.document.findMany({
      where: {
        id: { in: documentIds },
        deletedAt: null,
      },
      select: {
        id: true,
        filename: true,
        displayName: true,
        version: true,
        uploaderId: true,
        accessScope: true,
        accessMetadata: true,
        matterId: true,
        contactId: true,
        storageKey: true,
      },
    });

    if (documents.length === 0) {
      return NextResponse.json(
        { error: "No documents found" },
        { status: 404 }
      );
    }

    // Check access for each document
    const accessChecks = await Promise.all(
      documents.map((doc) =>
        checkDocumentAccess(
          {
            id: doc.id,
            uploaderId: doc.uploaderId,
            accessScope: doc.accessScope,
            accessMetadata: doc.accessMetadata as Record<string, unknown> | null,
            matterId: doc.matterId,
            contactId: doc.contactId,
          },
          { userId: user.id, userRole: user.role as "ADMIN" | "LAWYER" | "PARALEGAL" | "CLIENT" }
        )
      )
    );

    // Filter to only documents user has access to
    const accessibleDocs = documents.filter(
      (_, idx) => accessChecks[idx].hasAccess
    );
    const deniedDocIds = documentIds.filter(
      (id) => !accessibleDocs.some((doc) => doc.id === id)
    );

    if (accessibleDocs.length === 0) {
      return NextResponse.json(
        {
          error: "Access denied for all documents",
          denied: deniedDocIds,
        },
        { status: 403 }
      );
    }

    // For each accessible document, find its entire family (all versions)
    const documentFamilies = await Promise.all(
      accessibleDocs.map((doc) => findDocumentFamilyById(doc.id))
    );

    // Flatten to get all unique documents across all families
    const allDocuments = Array.from(
      new Map(
        documentFamilies.flat().map((doc) => [doc.id, doc])
      ).values()
    );

    // Delete all versions from storage
    const deletionResults = await Promise.allSettled(
      allDocuments.map((doc) =>
        deleteObject({ key: doc.storageKey }).catch((error) => {
          console.error("Failed to delete object from storage", {
            error,
            key: doc.storageKey,
            documentId: doc.id,
          });
          throw error;
        })
      )
    );

    // Check if any deletions failed
    const failedDeletions = deletionResults.filter(
      (result) => result.status === "rejected"
    );
    
    if (failedDeletions.length > 0) {
      console.error(`Failed to delete ${failedDeletions.length} of ${allDocuments.length} files from storage`);
      return NextResponse.json(
        { 
          error: "Unable to delete some files from storage",
          failedCount: failedDeletions.length,
          totalCount: allDocuments.length,
        },
        { status: 502 },
      );
    }

    // Delete all versions from database
    await prisma.document.deleteMany({
      where: { 
        id: { in: allDocuments.map(d => d.id) }
      },
    });

    // Log bulk delete
    await recordAuditLog({
      actorId: user.id,
      action: "document.bulk_delete",
      entityType: "document",
      entityId: accessibleDocs[0].id,
      metadata: {
        requestedDocumentIds: documentIds,
        accessibleDocumentIds: accessibleDocs.map((d) => d.id),
        familiesDeletedCount: accessibleDocs.length,
        totalVersionsDeletedCount: allDocuments.length,
        deniedCount: deniedDocIds.length,
      },
    });

    return NextResponse.json({
      success: true,
      familiesDeleted: accessibleDocs.length,
      totalVersionsDeleted: allDocuments.length,
      denied: deniedDocIds.length,
      deletedFamilyIds: accessibleDocs.map((d) => d.id),
      deniedIds: deniedDocIds,
    });
  },
  { requireAuth: true }
);
