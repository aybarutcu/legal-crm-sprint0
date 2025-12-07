import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { recordAuditLog } from "@/lib/audit";
import { checkFolderAccess, getFolderPath } from "@/lib/folders/access-control";
import { z } from "zod";

const folderUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  color: z.string().optional(),
  accessScope: z.enum(["PUBLIC", "ROLE_BASED", "USER_BASED", "PRIVATE"]).optional(),
  accessMetadata: z.record(z.unknown()).optional(),
});

export const GET = withApiHandler<{ id: string }>(
  async (req, { params, session }) => {
    const user = session!.user;
    const { id } = await params;

    const folder = await prisma.documentFolder.findUnique({
      where: { id, deletedAt: null },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        parentFolder: {
          select: {
            id: true,
            name: true,
            parentFolderId: true,
          },
        },
        matter: {
          select: {
            id: true,
            title: true,
          },
        },
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        accessGrants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        },
        _count: {
          select: {
            documents: { where: { deletedAt: null } },
            subfolders: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

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
      { userId: user.id, userRole: user.role }
    );

    if (!accessCheck.hasAccess) {
      return NextResponse.json(
        { error: "Access denied", reason: accessCheck.reason },
        { status: 403 }
      );
    }

    const path = await getFolderPath(folder.id);

    return NextResponse.json({ folder, path });
  },
  { requireAuth: true }
);

export const PATCH = withApiHandler<{ id: string }>(
  async (req, { params, session }) => {
    const user = session!.user;
    const { id } = await params;
    const body = await req.json();
    const data = folderUpdateSchema.parse(body);

    const folder = await prisma.documentFolder.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        createdById: true,
        accessScope: true,
        accessMetadata: true,
        matterId: true,
        contactId: true,
        parentFolderId: true,
        isMasterFolder: true,
      },
    });

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    const accessCheck = await checkFolderAccess(
      folder,
      { userId: user.id, userRole: user.role }
    );

    if (!accessCheck.hasAccess) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Only creator or admin can modify
    if (folder.createdById !== user.id && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only folder creator or admin can modify" },
        { status: 403 }
      );
    }

    // Check if this is a master folder (cannot be renamed or have access changed)
    if (folder.isMasterFolder) {
      // Master folders cannot be renamed
      if (data.name && data.name !== folder.name) {
        return NextResponse.json(
          { error: "Master folders cannot be renamed. This is the main folder for the matter/contact." },
          { status: 403 }
        );
      }
      
      // Master folders cannot have their access scope changed (must remain PUBLIC)
      if (data.accessScope && data.accessScope !== "PUBLIC") {
        return NextResponse.json(
          { error: "Master folders must remain PUBLIC for all team members." },
          { status: 403 }
        );
      }
      
      // Master folders cannot have access metadata changed
      if (data.accessMetadata !== undefined) {
        return NextResponse.json(
          { error: "Master folder access settings cannot be changed." },
          { status: 403 }
        );
      }
    }

    const updated = await prisma.documentFolder.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.accessScope && { accessScope: data.accessScope }),
        ...(data.accessMetadata !== undefined && { accessMetadata: data.accessMetadata }),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            documents: { where: { deletedAt: null } },
            subfolders: { where: { deletedAt: null } },
          },
        },
      },
    });

    await recordAuditLog({
      actorId: user.id,
      action: "folder.update",
      entityType: "folder",
      entityId: updated.id,
      metadata: {
        folderId: updated.id,
        folderName: updated.name,
        changes: data,
      },
    });

    return NextResponse.json({ folder: updated });
  },
  { requireAuth: true }
);

export const DELETE = withApiHandler<{ id: string }>(
  async (req, { params, session }) => {
    const user = session!.user;
    const { id } = await params;

    const folder = await prisma.documentFolder.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        createdById: true,
        accessScope: true,
        accessMetadata: true,
        matterId: true,
        contactId: true,
        parentFolderId: true,
        isMasterFolder: true,
      },
    });

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    const accessCheck = await checkFolderAccess(
      folder,
      { userId: user.id, userRole: user.role }
    );

    if (!accessCheck.hasAccess) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Only creator or admin can delete
    if (folder.createdById !== user.id && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only folder creator or admin can delete" },
        { status: 403 }
      );
    }

    // Check if this is a master folder (cannot be deleted)
    if (folder.isMasterFolder) {
      return NextResponse.json(
        { error: "Master folders cannot be deleted. This is the main folder for the matter/contact and must remain for organizational purposes." },
        { status: 403 }
      );
    }

    // Soft delete
    await prisma.documentFolder.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: user.id,
      },
    });

    await recordAuditLog({
      actorId: user.id,
      action: "folder.delete",
      entityType: "folder",
      entityId: folder.id,
      metadata: {
        folderId: folder.id,
        folderName: folder.name,
      },
    });

    return NextResponse.json({ success: true });
  },
  { requireAuth: true }
);
