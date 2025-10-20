import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string } };

export const GET = withApiHandler(
  async (_req: NextRequest, { params }: Params) => {
    const matterId = params.id;

    // Fetch audit logs for this matter
    const activities = await prisma.auditLog.findMany({
      where: {
        OR: [
          // Direct matter actions
          {
            entityType: "matter",
            entityId: matterId,
          },
          // Related entities (documents, workflows, etc.)
          {
            entityType: "document",
            metadata: {
              path: ["matterId"],
              equals: matterId,
            },
          },
          {
            entityType: "workflow",
            metadata: {
              path: ["matterId"],
              equals: matterId,
            },
          },
          {
            entityType: "task",
            metadata: {
              path: ["matterId"],
              equals: matterId,
            },
          },
        ],
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100, // Limit to last 100 activities
    });

    return NextResponse.json(activities);
  },
  { requireAuth: true }
);
