import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { recordAuditLog } from "@/lib/audit";
import { checkFolderAccess } from "@/lib/folders/access-control";
import { z } from "zod";

const bulkDeleteSchema = z.object({
  folderIds: z.array(z.string()).min(1).max(50), // Max 50 folders at once
});

export const POST = withApiHandler(
  async (req, { session }) => {
    const user = session!.user;
    if (!user?.id || !user?.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const body = await req.json();
    const { folderIds } = bulkDeleteSchema.parse(body);

    // Fetch all folders
    const folders = await prisma.documentFolder.findMany({
      where: {
        id: { in: folderIds },
        deletedAt: null,
      },
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

    if (folders.length === 0) {
      return NextResponse.json(
        { error: "No folders found" },
        { status: 404 }
      );
    }

    // Check access and permissions for each folder
    const results = await Promise.all(
      folders.map(async (folder) => {
        const accessCheck = await checkFolderAccess(
          {
            id: folder.id,
            createdById: folder.createdById,
            accessScope: folder.accessScope,
            accessMetadata: folder.accessMetadata as Record<string, unknown> | null,
            matterId: folder.matterId,
            contactId: folder.contactId,
            parentFolderId: folder.parentFolderId,
          },
          { userId: user.id, userRole: user.role as "ADMIN" | "LAWYER" | "PARALEGAL" | "CLIENT" }
        );

        const canDelete = accessCheck.hasAccess && 
          (folder.createdById === user.id || user.role === "ADMIN");

        return { folder, canDelete };
      })
    );

    // Filter to only folders user can delete
    const deletableFolders = results.filter((r) => r.canDelete).map((r) => r.folder);
    const deniedFolderIds = results.filter((r) => !r.canDelete).map((r) => r.folder.id);

    if (deletableFolders.length === 0) {
      return NextResponse.json(
        {
          error: "Permission denied for all folders",
          denied: deniedFolderIds,
        },
        { status: 403 }
      );
    }

    // Soft delete all accessible folders
    await prisma.documentFolder.updateMany({
      where: {
        id: { in: deletableFolders.map((f) => f.id) },
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
      action: "folder.bulk_delete",
      entityType: "folder",
      entityId: deletableFolders[0].id,
      metadata: {
        folderIds: deletableFolders.map((f) => f.id),
        folderNames: deletableFolders.map((f) => f.name),
        count: deletableFolders.length,
        denied: deniedFolderIds.length,
      },
    });

    return NextResponse.json({
      success: true,
      deleted: deletableFolders.length,
      denied: deniedFolderIds.length,
      deletedIds: deletableFolders.map((f) => f.id),
      deniedIds: deniedFolderIds,
    });
  },
  { requireAuth: true }
);
