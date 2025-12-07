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

const createTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  description: z.string().optional(),
  structure: folderStructureSchema,
  isDefault: z.boolean().optional(),
});

export const GET = withApiHandler(
  async (req, { session }) => {
    const user = session!.user;
    const { searchParams } = new URL(req.url);
    
    const includeDefaults = searchParams.get("includeDefaults") !== "false";
    const createdByMe = searchParams.get("createdByMe") === "true";

    const where: any = {};
    
    if (createdByMe) {
      where.createdById = user.id;
    } else if (user.role !== "ADMIN") {
      // Non-admins see only their own templates + default templates
      where.OR = [
        { createdById: user.id },
        { isDefault: true },
      ];
    }

    const templates = await prisma.folderTemplate.findMany({
      where,
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "desc" },
      ],
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

    return NextResponse.json({ templates });
  },
  { requireAuth: true }
);

export const POST = withApiHandler(
  async (req, { session }) => {
    const user = session!.user;
    const body = await req.json();
    const data = createTemplateSchema.parse(body);

    // Only admins can create default templates
    if (data.isDefault && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only administrators can create default templates" },
        { status: 403 }
      );
    }

    const template = await prisma.folderTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        structure: data.structure,
        isDefault: data.isDefault ?? false,
        createdById: user.id,
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
      action: "folder_template.create",
      entityType: "folder_template",
      entityId: template.id,
      metadata: {
        name: template.name,
        isDefault: template.isDefault,
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  },
  { requireAuth: true }
);
