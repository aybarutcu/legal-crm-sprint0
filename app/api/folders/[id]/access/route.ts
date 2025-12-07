import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { recordAuditLog } from "@/lib/audit";
import { grantFolderAccess, getFolderAccessGrants } from "@/lib/folders/access-control";
import { z } from "zod";

const grantSchema = z.object({
  userId: z.string(),
});

const updateAccessSchema = z.object({
  accessScope: z.enum(["PUBLIC", "ROLE_BASED", "USER_BASED", "PRIVATE"]),
  accessMetadata: z.object({
    allowedRoles: z.array(z.string()).optional(),
  }).optional(),
  userIds: z.array(z.string()).optional(),
});

export const GET = withApiHandler<{ id: string }>(
  async (req, { params, session }) => {
    const user = session!.user;
    const { id } = await params;

    // Get folder
    const folder = await prisma.documentFolder.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        createdById: true,
      },
    });

    if (!folder) {
      return NextResponse.json(
        { error: "Folder not found" },
        { status: 404 }
      );
    }

    // Only creator or admin can view access grants
    if (folder.createdById !== user.id && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    const grants = await getFolderAccessGrants(id);

    return NextResponse.json({ grants });
  },
  { requireAuth: true }
);

export const POST = withApiHandler<{ id: string }>(
  async (req, { params, session }) => {
    const user = session!.user;
    const { id } = await params;
    const body = await req.json();
    const { userId } = grantSchema.parse(body);

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

    // Only creator or admin can grant access
    if (folder.createdById !== user.id && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Grant access
    await grantFolderAccess(id, userId, user.id);

    await recordAuditLog({
      actorId: user.id,
      action: "folder_access.grant",
      entityType: "folder",
      entityId: id,
      metadata: {
        folderName: folder.name,
        grantedToUserId: userId,
      },
    });

    return NextResponse.json({ success: true });
  },
  { requireAuth: true }
);

export const PUT = withApiHandler<{ id: string }>(
  async (req, { params, session }) => {
    const user = session!.user;
    const { id } = await params;

    // Get folder
    const folder = await prisma.documentFolder.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        createdById: true,
        accessScope: true,
      },
    });

    if (!folder) {
      return NextResponse.json(
        { error: "Folder not found" },
        { status: 404 }
      );
    }

    // Check permissions - only admins and folder creator can modify access
    if (user.role !== "ADMIN" && folder.createdById !== user.id) {
      return NextResponse.json(
        { error: "Insufficient permissions to modify folder access" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { accessScope, accessMetadata, userIds } = updateAccessSchema.parse(body);

    // Update folder in a transaction
    await prisma.$transaction(async (tx) => {
      // Update folder access scope and metadata
      await tx.documentFolder.update({
        where: { id },
        data: {
          accessScope,
          accessMetadata: accessMetadata || null,
        },
      });

      if (accessScope === "USER_BASED" && userIds) {
        // Remove existing grants
        await tx.folderAccess.deleteMany({
          where: { folderId: id },
        });

        // Create new grants
        if (userIds.length > 0) {
          await tx.folderAccess.createMany({
            data: userIds.map(userId => ({
              folderId: id,
              userId,
              grantedBy: user.id,
            })),
          });
        }
      } else {
        // For non-user-based scopes, remove all grants
        await tx.folderAccess.deleteMany({
          where: { folderId: id },
        });
      }
    });

    await recordAuditLog({
      actorId: user.id,
      action: "folder_access.update",
      entityType: "folder",
      entityId: id,
      metadata: {
        folderName: folder.name,
        oldAccessScope: folder.accessScope,
        newAccessScope: accessScope,
        accessMetadata,
      },
    });

    return NextResponse.json({ success: true });
  },
  { requireAuth: true }
);
