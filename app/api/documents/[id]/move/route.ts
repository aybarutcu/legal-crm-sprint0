import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { recordAuditLog } from "@/lib/audit";
import { checkDocumentAccess } from "@/lib/documents/access-control";
import { checkFolderAccess } from "@/lib/folders/access-control";
import { z } from "zod";

const moveSchema = z.object({
  folderId: z.string().nullable(),
});

export const PATCH = withApiHandler<{ id: string }>(
  async (req, { params, session }) => {
    const user = session!.user;
    const { id } = await params;
    const body = await req.json();
    const { folderId } = moveSchema.parse(body);

    // Get the document
    const document = await prisma.document.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        filename: true,
        uploaderId: true,
        accessScope: true,
        accessMetadata: true,
        matterId: true,
        contactId: true,
        folderId: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Check document access
    const docAccess = await checkDocumentAccess(
      document,
      { userId: user.id, userRole: user.role }
    );

    if (!docAccess.hasAccess) {
      return NextResponse.json(
        { error: "Access denied to document" },
        { status: 403 }
      );
    }

    // If moving to a folder, check folder access
    if (folderId) {
      const folder = await prisma.documentFolder.findUnique({
        where: { id: folderId, deletedAt: null },
        select: {
          id: true,
          name: true,
          createdById: true,
          accessScope: true,
          accessMetadata: true,
          matterId: true,
          contactId: true,
          parentFolderId: true,
        },
      });

      if (!folder) {
        return NextResponse.json(
          { error: "Folder not found" },
          { status: 404 }
        );
      }

      // Verify folder belongs to same matter/contact
      // Allow moving if:
      // 1. Both have same matterId (or both null)
      // 2. Both have same contactId (or both null)
      // 3. Document has contactId but folder has null contactId is OK if same matter
      if (document.matterId !== null && folder.matterId !== null) {
        if (document.matterId !== folder.matterId) {
          return NextResponse.json(
            { error: "Cannot move document to folder in different matter" },
            { status: 400 }
          );
        }
      }

      if (document.contactId !== null && folder.contactId !== null) {
        if (document.contactId !== folder.contactId) {
          return NextResponse.json(
            { error: "Cannot move document to folder in different contact" },
            { status: 400 }
          );
        }
      }

      // Prevent moving matter documents to contact folders and vice versa
      if (document.matterId && folder.contactId) {
        return NextResponse.json(
          { error: "Cannot move matter document to contact folder" },
          { status: 400 }
        );
      }

      if (document.contactId && folder.matterId) {
        return NextResponse.json(
          { error: "Cannot move contact document to matter folder" },
          { status: 400 }
        );
      }

      const folderAccess = await checkFolderAccess(
        folder,
        { userId: user.id, userRole: user.role }
      );

      if (!folderAccess.hasAccess) {
        return NextResponse.json(
          { error: "Access denied to destination folder" },
          { status: 403 }
        );
      }
    }

    // Update document
    const updated = await prisma.document.update({
      where: { id },
      data: { folderId },
      include: {
        folder: {
          select: { id: true, name: true },
        },
      },
    });

    await recordAuditLog({
      actorId: user.id,
      action: "document.move",
      entityType: "document",
      entityId: updated.id,
      metadata: {
        filename: document.filename,
        fromFolderId: document.folderId,
        toFolderId: folderId,
      },
    });

    return NextResponse.json({ document: updated });
  },
  { requireAuth: true }
);
