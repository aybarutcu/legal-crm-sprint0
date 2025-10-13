import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { buildMatterAccessFilter } from "@/lib/tasks/service";

export const GET = withApiHandler(async (_req, { session }) => {
  const user = session!.user!;

  const [assignees, matters] = await Promise.all([
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
      take: 100,
    }),
    prisma.matter.findMany({
      where: buildMatterAccessFilter(user),
      orderBy: { title: "asc" },
      select: { id: true, title: true },
      take: 100,
    }),
  ]);

  return NextResponse.json({
    assignees: assignees.map((item) => ({
      id: item.id,
      name: item.name ?? item.email ?? "Unnamed",
      email: item.email,
      role: item.role,
    })),
    matters,
  });
});
