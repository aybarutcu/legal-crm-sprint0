import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import {
  workflowTemplateUpdateSchema,
} from "@/lib/validation/workflow";
import { requireAdmin } from "@/lib/authorization";

type Params = { params: { id: string } };

export const GET = withApiHandler(
  async (_req: NextRequest, { session, params }: Params) => {
    await requireAdmin(session);

    const template = await prisma.workflowTemplate.findUnique({
      where: { id: params.id },
      include: {
        steps: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    return NextResponse.json(template);
  },
);

export const PATCH = withApiHandler(
  async (req: NextRequest, { session, params }: Params) => {
    await requireAdmin(session);
    const payload = workflowTemplateUpdateSchema.parse(await req.json());

    const template = await prisma.workflowTemplate.findUnique({
      where: { id: params.id },
      select: { id: true, isActive: true },
    });

    if (!template) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    if (template.isActive) {
      return NextResponse.json(
        { error: "Template is active and cannot be modified" },
        { status: 409 },
      );
    }

    const data: Prisma.WorkflowTemplateUpdateInput = {
      name: payload.name ?? undefined,
      description:
        payload.description === undefined
          ? undefined
          : payload.description ?? null,
    };

    if (payload.steps) {
      data.steps = {
        deleteMany: {},
        create: payload.steps.map((step, index) => ({
          title: step.title,
          actionType: step.actionType,
          roleScope: step.roleScope,
          required: step.required ?? true,
          actionConfig: step.actionConfig ?? {},
          order: step.order ?? index,
        })),
      };
    }

    const updated = await prisma.workflowTemplate.update({
      where: { id: params.id },
      data,
      include: {
        steps: {
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json(updated);
  },
);

export const DELETE = withApiHandler(
  async (_req: NextRequest, { session, params }: Params) => {
    await requireAdmin(session);

    const existing = await prisma.workflowTemplate.findUnique({
      where: { id: params.id },
      select: { id: true, isActive: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    if (existing.isActive) {
      const hasInstances = await prisma.workflowInstance.count({
        where: { templateId: params.id },
      });
      if (hasInstances > 0) {
        return NextResponse.json(
          { error: "Template has instances and cannot be deleted" },
          { status: 409 },
        );
      }
    }

    await prisma.workflowTemplate.delete({
      where: { id: params.id },
    });

    return new NextResponse(null, { status: 204 });
  },
);
