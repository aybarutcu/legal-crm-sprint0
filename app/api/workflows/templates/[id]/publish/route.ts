import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authorization";

type Params = { params: { id: string } };

export const POST = withApiHandler(
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

    if (template.isActive) {
      return NextResponse.json({ error: "Template already published" }, { status: 409 });
    }

    if (template.steps.length === 0) {
      return NextResponse.json({ error: "Template must contain at least one step" }, { status: 400 });
    }

    const published = await prisma.$transaction(async (tx) => {
      await tx.workflowTemplate.updateMany({
        where: {
          name: template.name,
          isActive: true,
          NOT: { id: template.id },
        },
        data: { isActive: false },
      });

      return tx.workflowTemplate.update({
        where: { id: template.id },
        data: { isActive: true },
        include: {
          steps: {
            orderBy: { order: "asc" },
          },
        },
      });
    });

    return NextResponse.json(published);
  },
);
