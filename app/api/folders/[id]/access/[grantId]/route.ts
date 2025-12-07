import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { recordAuditLog } from "@/lib/audit";
import { revokeFolderAccess } from "@/lib/folders/access-control";

export const DELETE = withApiHandler<{ id: string; grantId: string }>(
  async (req, { params, session }) => {
    const user = session!.user;
    const { id, grantId } = await params;

    // Get folder
    const folder = await prisma.documentFolder.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        createdById: true,
      },
    });

    if (!folder) {
      return NextResponse.json(
        { error: "Folder not found" },
        { status: 404 }
      );
    }

    // Only creator or admin can revoke access
    if (folder.createdById !== user.id && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Get grant to log the revoked user
    const grant = await prisma.folderAccess.findUnique({
      where: { id: grantId },
      select: { userId: true },
    });

    if (!grant) {
      return NextResponse.json(
        { error: "Access grant not found" },
        { status: 404 }
      );
    }

    // Revoke access
    await revokeFolderAccess(id, grant.userId);

    await recordAuditLog({
      actorId: user.id,
      action: "folder_access.revoke",
      entityType: "folder",
      entityId: id,
      metadata: {
        folderName: folder.name,
        revokedFromUserId: grant.userId,
      },
    });

    return NextResponse.json({ success: true });
  },
  { requireAuth: true }
);
