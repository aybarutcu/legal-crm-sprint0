import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { assertMatterAccess } from "@/lib/authorization";

export const GET = withApiHandler<{ id: string }>(
  async (_req: NextRequest, { params, session }) => {
    const user = session!.user!;
    const instance = await prisma.workflowInstance.findUnique({
      where: { id: params!.id },
      include: {
        template: { select: { name: true } },
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
