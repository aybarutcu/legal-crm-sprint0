import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const querySchema = z.object({
  matterId: z.string().trim().min(1).optional(),
});

export const GET = withApiHandler(async (req: NextRequest, { session }) => {
  const user = session!.user!;
  const { matterId } = querySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams),
  );

  // Build matter access filter - allow if user is matter owner OR is a team member
  const matterAccessFilter = user.role === "ADMIN"
    ? {}
    : {
        matter: {
          OR: [
            { ownerId: user.id },
            { teamMembers: { some: { userId: user.id } } },
          ],
        },
      };

  const instances = await prisma.workflowInstance.findMany({
    where: {
      matterId,
      ...matterAccessFilter,
    },
    include: {
      template: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      steps: {
        orderBy: { order: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(instances);
});
