import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { assertMatterAccess } from "@/lib/authorization";
import { Role } from "@prisma/client";

export const GET = withApiHandler<{ id: string }>(
  async (_req: NextRequest, { params, session }) => {
    const user = session!.user!;
    const instance = await prisma.workflowInstance.findUnique({
      where: { id: params!.id },
      include: {
        template: { select: { name: true, contextSchema: true } },
        matter: { select: { id: true, title: true } },
        createdBy: { select: { name: true } },
        steps: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (instance) {
      await assertMatterAccess(user, instance.matterId);
    }

    return NextResponse.json(instance);
  },
);

export const DELETE = withApiHandler<{ id: string }>(
  async (_req: NextRequest, { params, session }) => {
    const user = session!.user!;

    const instance = await prisma.workflowInstance.findUnique({
      where: { id: params!.id },
      select: { id: true, matterId: true },
    });

    if (!instance) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    // Only ADMIN or LAWYER can remove workflow instances
    if (user.role !== Role.ADMIN && user.role !== Role.LAWYER) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Ensure the user has access to the matter (ADMIN passes; owner required otherwise)
    await assertMatterAccess(user, instance.matterId);

    await prisma.workflowInstance.delete({
      where: { id: instance.id },
    });

    return NextResponse.json({ success: true });
  },
);
