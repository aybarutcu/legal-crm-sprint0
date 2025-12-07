import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { recordAuditLog } from "@/lib/audit";
import { z } from "zod";

const applyTemplateSchema = z.object({
  matterId: z.string().optional(),
  contactId: z.string().optional(),
  parentFolderId: z.string().nullable().optional(),
}).refine(
  (data) => data.matterId || data.contactId,
  { message: "Either matterId or contactId must be provided" }
);

interface FolderNode {
  name: string;
  color?: string;
  children?: FolderNode[];
}

async function createFoldersFromStructure(
  structure: FolderNode,
  options: {
    matterId?: string;
    contactId?: string;
    parentFolderId?: string | null;
    createdById: string;
  }
): Promise<string> {
  // Create the folder
  const folder = await prisma.documentFolder.create({
    data: {
      name: structure.name,
      color: structure.color,
      matterId: options.matterId,
      contactId: options.contactId,
      parentFolderId: options.parentFolderId,
      createdById: options.createdById,
      accessScope: "PUBLIC",
    },
  });

  // Recursively create children
  if (structure.children && structure.children.length > 0) {
    await Promise.all(
      structure.children.map((child) =>
        createFoldersFromStructure(child, {
          ...options,
          parentFolderId: folder.id,
        })
      )
    );
  }

  return folder.id;
}

export const POST = withApiHandler<{ id: string }>(
  async (req, { params, session }) => {
    const user = session!.user;
    const { id } = await params;
    const body = await req.json();
    const data = applyTemplateSchema.parse(body);

    // Get the template
    const template = await prisma.folderTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Check access to template
    if (
      template.createdById !== user.id &&
      user.role !== "ADMIN" &&
      !template.isDefault
    ) {
      return NextResponse.json(
        { error: "Access denied to template" },
        { status: 403 }
      );
    }

    // Verify matter/contact access
    if (data.matterId) {
      const matter = await prisma.matter.findUnique({
        where: { id: data.matterId, deletedAt: null },
        select: { id: true, ownerId: true },
      });

      if (!matter) {
        return NextResponse.json(
          { error: "Matter not found" },
          { status: 404 }
        );
      }

      // Check if user has access to this matter
      if (matter.ownerId !== user.id && user.role !== "ADMIN") {
        const teamMember = await prisma.matterTeamMember.findFirst({
          where: {
            matterId: data.matterId,
            userId: user.id,
          },
        });

        if (!teamMember) {
          return NextResponse.json(
            { error: "Access denied to matter" },
            { status: 403 }
          );
        }
      }
    }

    if (data.contactId) {
      const contact = await prisma.contact.findUnique({
        where: { id: data.contactId, deletedAt: null },
        select: { id: true, ownerId: true },
      });

      if (!contact) {
        return NextResponse.json(
          { error: "Contact not found" },
          { status: 404 }
        );
      }

      // Check if user has access to this contact
      if (contact.ownerId !== user.id && user.role !== "ADMIN") {
        return NextResponse.json(
          { error: "Access denied to contact" },
          { status: 403 }
        );
      }
    }

    // If parentFolderId is provided, verify it exists and belongs to the same context
    if (data.parentFolderId) {
      const parentFolder = await prisma.documentFolder.findUnique({
        where: { id: data.parentFolderId, deletedAt: null },
        select: { id: true, matterId: true, contactId: true },
      });

      if (!parentFolder) {
        return NextResponse.json(
          { error: "Parent folder not found" },
          { status: 404 }
        );
      }

      if (parentFolder.matterId !== data.matterId || parentFolder.contactId !== data.contactId) {
        return NextResponse.json(
          { error: "Parent folder does not belong to the specified matter/contact" },
          { status: 400 }
        );
      }
    }

    // Apply the template structure
    const structure = template.structure as FolderNode;
    const rootFolderId = await createFoldersFromStructure(structure, {
      matterId: data.matterId,
      contactId: data.contactId,
      parentFolderId: data.parentFolderId ?? null,
      createdById: user.id,
    });

    await recordAuditLog({
      actorId: user.id,
      action: "folder_template.apply",
      entityType: "folder_template",
      entityId: template.id,
      metadata: {
        templateName: template.name,
        matterId: data.matterId,
        contactId: data.contactId,
        rootFolderId,
      },
    });

    return NextResponse.json({
      success: true,
      rootFolderId,
      message: `Template "${template.name}" applied successfully`,
    });
  },
  { requireAuth: true }
);
