import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { recordAuditLog } from "@/lib/audit";
import { checkFolderAccess } from "@/lib/folders/access-control";
import { z } from "zod";

const folderCreateSchema = z.object({
  name: z.string().min(1).max(255),
  matterId: z.string().optional(),
  contactId: z.string().optional(),
  parentFolderId: z.string().optional(),
  color: z.string().optional(),
  accessScope: z.enum(["PUBLIC", "ROLE_BASED", "USER_BASED", "PRIVATE"]).optional(),
  accessMetadata: z.record(z.unknown()).optional(),
});

const folderQuerySchema = z.object({
  matterId: z.string().optional(),
  contactId: z.string().optional(),
  parentFolderId: z.string().optional(),
});

export const GET = withApiHandler(
  async (req, { session }) => {
    const user = session!.user;
    const queryParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const { matterId, contactId, parentFolderId } = folderQuerySchema.parse(queryParams);

    let folders = [];

    // If parentFolderId is specified, only get direct children of that folder
    if (parentFolderId !== undefined) {
      const where: any = {
        deletedAt: null,
      };

      if (parentFolderId === "null" || parentFolderId === "") {
        where.parentFolderId = null;
        // Only apply matterId/contactId filters at root level
        if (matterId) where.matterId = matterId;
        if (contactId) where.contactId = contactId;
      } else {
        where.parentFolderId = parentFolderId;
      }

      folders = await prisma.documentFolder.findMany({
        where,
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
          _count: {
            select: {
              documents: { where: { deletedAt: null } },
              subfolders: { where: { deletedAt: null } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } else if (matterId || contactId) {
      // Get ALL folders for this matter/contact (including subfolders)
      // First, find the root folder(s) for this matter/contact
      const rootFolders = await prisma.documentFolder.findMany({
        where: {
          deletedAt: null,
          ...(matterId && { matterId }),
          ...(contactId && { contactId }),
        },
      });

      // Get all folder IDs in the hierarchy
      const allFolderIds = new Set<string>();
      const collectFolderIds = async (folderIds: string[]) => {
        if (folderIds.length === 0) return;
        
        for (const folderId of folderIds) {
          if (!allFolderIds.has(folderId)) {
            allFolderIds.add(folderId);
          }
        }

        // When collecting children, ensure they either:
        // 1. Don't have matterId/contactId set (inherit from parent), OR
        // 2. Have the SAME matterId/contactId as we're searching for
        const childrenWhere: any = {
          parentFolderId: { in: folderIds },
          deletedAt: null,
        };

        // Add filter to prevent cross-contamination from other matters/contacts
        if (matterId) {
          childrenWhere.OR = [
            { matterId: null },      // Subfolders without explicit matterId
            { matterId: matterId },  // Or folders explicitly for this matter
          ];
        }
        if (contactId) {
          childrenWhere.OR = [
            { contactId: null },         // Subfolders without explicit contactId
            { contactId: contactId },    // Or folders explicitly for this contact
          ];
        }

        const children = await prisma.documentFolder.findMany({
          where: childrenWhere,
          select: { id: true },
        });

        if (children.length > 0) {
          await collectFolderIds(children.map(c => c.id));
        }
      };

      await collectFolderIds(rootFolders.map(f => f.id));

      // Now fetch all folders with full data
      folders = await prisma.documentFolder.findMany({
        where: {
          id: { in: Array.from(allFolderIds) },
          deletedAt: null,
        },
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
          _count: {
            select: {
              documents: { where: { deletedAt: null } },
              subfolders: { where: { deletedAt: null } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } else {
      // No filters - return all accessible folders
      folders = await prisma.documentFolder.findMany({
        where: { deletedAt: null },
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
        orderBy: { createdAt: "desc" },
      });
    }

    // Filter folders based on access control
    const accessibleFolders = [];
    for (const folder of folders) {
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

      if (accessCheck.hasAccess) {
        accessibleFolders.push(folder);
      }
    }

    return NextResponse.json({ folders: accessibleFolders });
  },
  { requireAuth: true }
);

export const POST = withApiHandler(
  async (req, { session }) => {
    const user = session!.user;
    const body = await req.json();
    const data = folderCreateSchema.parse(body);

    // If parent folder is specified, check access
    if (data.parentFolderId) {
      const parentFolder = await prisma.documentFolder.findUnique({
        where: { id: data.parentFolderId },
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

      if (!parentFolder) {
        return NextResponse.json(
          { error: "Parent folder not found" },
          { status: 404 }
        );
      }

      const accessCheck = await checkFolderAccess(
        parentFolder,
        { userId: user.id, userRole: user.role }
      );

      if (!accessCheck.hasAccess) {
        return NextResponse.json(
          { error: "Access denied to parent folder" },
          { status: 403 }
        );
      }
    }

    const folder = await prisma.documentFolder.create({
      data: {
        name: data.name,
        matterId: data.matterId,
        contactId: data.contactId,
        parentFolderId: data.parentFolderId,
        createdById: user.id,
        color: data.color,
        accessScope: data.accessScope || "PUBLIC",
        accessMetadata: data.accessMetadata,
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
      action: "folder.create",
      entityType: "folder",
      entityId: folder.id,
      metadata: {
        folderId: folder.id,
        folderName: folder.name,
        matterId: folder.matterId,
        contactId: folder.contactId,
        parentFolderId: folder.parentFolderId,
      },
    });

    return NextResponse.json({ folder }, { status: 201 });
  },
  { requireAuth: true }
);
