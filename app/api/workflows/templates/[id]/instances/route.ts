import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";

export const GET = withApiHandler(
  async (_req: NextRequest, { session, params }: { session?: Session | null; params?: { id: string } }) => {
    if (!params?.id) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    // Get all workflow instances for this template with their associated matters or contacts
    const instances = await prisma.workflowInstance.findMany({
      where: {
        templateId: params.id,
        // Only get instances that have a matter (not contact-only workflows)
        matterId: {
          not: null,
        },
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        matter: {
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            client: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(instances);
  },
);

