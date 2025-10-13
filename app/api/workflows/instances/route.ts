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

  const instances = await prisma.workflowInstance.findMany({
    where: {
      matterId,
      ...(user.role !== "ADMIN" && { matter: { ownerId: user.id } }),
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
