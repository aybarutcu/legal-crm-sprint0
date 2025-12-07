import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { recordAuditLog } from "@/lib/audit";
import { checkDocumentAccess } from "@/lib/documents/access-control";
import { checkFolderAccess } from "@/lib/folders/access-control";
import { z } from "zod";

const bulkMoveSchema = z.object({
  documentIds: z.array(z.string()).min(1).max(100), // Max 100 documents at once
  targetFolderId: z.string().nullable(), // null = move to root (no folder)
});

export const POST = withApiHandler(
  async (req, { session }) => {
    const user = session!.user;
    if (!user?.id || !user?.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const body = await req.json();
    const { documentIds, targetFolderId } = bulkMoveSchema.parse(body);

    // Check target folder access if specified
    if (targetFolderId) {
      const targetFolder = await prisma.documentFolder.findUnique({
        where: { id: targetFolderId, deletedAt: null },
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

      if (!targetFolder) {
        return NextResponse.json(
          { error: "Target folder not found" },
          { status: 404 }
        );
      }

      const folderAccessCheck = await checkFolderAccess(
        {
          id: targetFolder.id,
          createdById: targetFolder.createdById,
          accessScope: targetFolder.accessScope,
          accessMetadata: targetFolder.accessMetadata as Record<string, unknown> | null,
          matterId: targetFolder.matterId,
          contactId: targetFolder.contactId,
          parentFolderId: targetFolder.parentFolderId,
        },
        { userId: user.id, userRole: user.role as "ADMIN" | "LAWYER" | "PARALEGAL" | "CLIENT" }
      );

      if (!folderAccessCheck.hasAccess) {
        return NextResponse.json(
          { error: "Access denied to target folder" },
          { status: 403 }
        );
      }
    }

    // Fetch all documents
    const documents = await prisma.document.findMany({
      where: {
        id: { in: documentIds },
        deletedAt: null,
      },
      select: {
        id: true,
        filename: true,
        folderId: true,
        uploaderId: true,
        accessScope: true,
        accessMetadata: true,
        matterId: true,
        contactId: true,
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

    // Move all accessible documents to target folder
    const moved = await Promise.all(
      accessibleDocs.map((doc) =>
        prisma.document.update({
          where: { id: doc.id },
          data: { folderId: targetFolderId },
          select: {
            id: true,
            filename: true,
            folderId: true,
          },
        })
      )
    );

    // Log bulk move
    await recordAuditLog({
      actorId: user.id,
      action: "document.bulk_move",
      entityType: "document",
      entityId: accessibleDocs[0].id,
      metadata: {
        documentIds: accessibleDocs.map((d) => d.id),
        count: accessibleDocs.length,
        targetFolderId,
        denied: deniedDocIds.length,
      },
    });

    return NextResponse.json({
      success: true,
      moved: moved.length,
      denied: deniedDocIds.length,
      movedIds: moved.map((d) => d.id),
      deniedIds: deniedDocIds,
      targetFolderId,
    });
  },
  { requireAuth: true }
);
