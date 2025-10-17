import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export const GET = withApiHandler(async (req: NextRequest, { session }) => {
  const user = session!.user!;
  
  // Only authenticated users can list users
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get role filter from query params
  const { searchParams } = req.nextUrl;
  const roleParam = searchParams.get("role");
  
  let roleFilter: Role[] | undefined;
  if (roleParam) {
    const roles = roleParam.split(",").filter(r => 
      ["ADMIN", "LAWYER", "PARALEGAL", "CLIENT"].includes(r)
    ) as Role[];
    roleFilter = roles.length > 0 ? roles : undefined;
  }

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      ...(roleFilter && roleFilter.length > 0 ? { role: { in: roleFilter } } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
    orderBy: [
      { role: "asc" },
      { name: "asc" },
    ],
  });

  return NextResponse.json(users);
});
