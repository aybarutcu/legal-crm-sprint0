import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { recordAuditLog } from "@/lib/audit";
import { checkDocumentAccess } from "@/lib/documents/access-control";
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
        deletedAt: null, // Only operate on non-deleted documents
      },
      select: {
        id: true,
        filename: true,
        uploaderId: true,
        accessScope: true,
        accessMetadata: true,
        matterId: true,
        contactId: true,
        version: true,
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
    const accessibleDocIds = documents
      .filter((_, idx) => accessChecks[idx].hasAccess)
      .map((doc) => doc.id);

    const deniedDocIds = documentIds.filter(
      (id) => !accessibleDocIds.includes(id)
    );

    if (accessibleDocIds.length === 0) {
      return NextResponse.json(
        {
          error: "Access denied for all documents",
          denied: deniedDocIds,
        },
        { status: 403 }
      );
    }

    // Soft delete all accessible documents
    await prisma.document.updateMany({
      where: {
        id: { in: accessibleDocIds },
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
        deletedBy: user.id,
      },
    });

    // Log bulk deletion
    await recordAuditLog({
      actorId: user.id,
      action: "document.bulk_delete",
      entityType: "document",
      entityId: accessibleDocIds[0], // First document ID as reference
      metadata: {
        documentIds: accessibleDocIds,
        count: accessibleDocIds.length,
        denied: deniedDocIds.length,
      },
    });

    return NextResponse.json({
      success: true,
      deleted: accessibleDocIds.length,
      denied: deniedDocIds.length,
      deletedIds: accessibleDocIds,
      deniedIds: deniedDocIds,
    });
  },
  { requireAuth: true }
);
