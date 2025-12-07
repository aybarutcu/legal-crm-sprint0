import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { recordAuditLog } from "@/lib/audit";
import { z } from "zod";

const folderStructureSchema = z.object({
  name: z.string(),
  color: z.string().optional(),
  children: z.array(z.lazy(() => folderStructureSchema)).optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  structure: folderStructureSchema.optional(),
  isDefault: z.boolean().optional(),
});

export const GET = withApiHandler<{ id: string }>(
  async (req, { params, session }) => {
    const user = session!.user;
    const { id } = await params;

    const template = await prisma.folderTemplate.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Check access: creator or admin can view, or if it's a default template
    if (
      template.createdById !== user.id &&
      user.role !== "ADMIN" &&
      !template.isDefault
    ) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    return NextResponse.json({ template });
  },
  { requireAuth: true }
);

export const PATCH = withApiHandler<{ id: string }>(
  async (req, { params, session }) => {
    const user = session!.user;
    const { id } = await params;
    const body = await req.json();
    const data = updateTemplateSchema.parse(body);

    const template = await prisma.folderTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Check access: only creator or admin can update
    if (template.createdById !== user.id && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Only admins can set isDefault
    if (data.isDefault !== undefined && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only administrators can modify default template status" },
        { status: 403 }
      );
    }

    const updated = await prisma.folderTemplate.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        structure: data.structure,
        isDefault: data.isDefault,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await recordAuditLog({
      actorId: user.id,
      action: "folder_template.update",
      entityType: "folder_template",
      entityId: updated.id,
      metadata: {
        name: updated.name,
        changes: Object.keys(data),
      },
    });

    return NextResponse.json({ template: updated });
  },
  { requireAuth: true }
);

export const DELETE = withApiHandler<{ id: string }>(
  async (req, { params, session }) => {
    const user = session!.user;
    const { id } = await params;

    const template = await prisma.folderTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Check access: only creator or admin can delete
    if (template.createdById !== user.id && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    await prisma.folderTemplate.delete({
      where: { id },
    });

    await recordAuditLog({
      actorId: user.id,
      action: "folder_template.delete",
      entityType: "folder_template",
      entityId: id,
      metadata: {
        name: template.name,
      },
    });

    return NextResponse.json({ success: true });
  },
  { requireAuth: true }
);
