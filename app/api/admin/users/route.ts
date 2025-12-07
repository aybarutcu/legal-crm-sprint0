import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const GET = withApiHandler(async (req, { session }) => {
  const actor = session!.user!;
  if (![Role.ADMIN, Role.LAWYER].includes((actor.role ?? Role.LAWYER) as "ADMIN" | "LAWYER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const search = req.nextUrl.searchParams.get("q")?.trim();
  const roleFilter = req.nextUrl.searchParams.get("role") as Role | null;

  const where = {
    ...(search
      ? {
          OR: [
            { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {}),
    ...(roleFilter ? { role: roleFilter } : {}),
  };

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      clientProfile: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      invitedBy: {
        select: { id: true, name: true, email: true },
      },
    },
    take: 200,
  });

  return NextResponse.json(
    users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      isActive: user.isActive,
      invitedAt: user.invitedAt ? user.invitedAt.toISOString() : null,
      activatedAt: user.activatedAt ? user.activatedAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      contact: user.clientProfile
        ? {
            id: user.clientProfile.id,
            firstName: user.clientProfile.firstName,
            lastName: user.clientProfile.lastName,
          }
        : null,
      invitedBy: user.invitedBy
        ? {
            id: user.invitedBy.id,
            name: user.invitedBy.name,
            email: user.invitedBy.email,
          }
        : null,
    })),
  );
});
