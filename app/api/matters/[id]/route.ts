import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { matterUpdateSchema } from "@/lib/validation/matter";
import { recordAuditLog } from "@/lib/audit";
import { withApiHandler } from "@/lib/api-handler";
import { assertCanModifyResource, isAdmin } from "@/lib/authorization";

type MatterParams = {
  id: string;
};

export const GET = withApiHandler<MatterParams>(async (_req, { params }) => {
  const matter = await prisma.matter.findUnique({
    where: { id: params!.id },
    include: {
      client: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      owner: {
        select: { id: true, name: true, email: true },
      },
      parties: {
        include: {
          contact: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      documents: {
        select: { id: true, filename: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      tasks: {
        select: { id: true, title: true, status: true, dueAt: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!matter) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  return NextResponse.json({
    ...matter,
    openedAt: matter.openedAt.toISOString(),
    nextHearingAt: matter.nextHearingAt?.toISOString() ?? null,
    parties: matter.parties.map((party) => ({
      id: party.id,
      role: party.role,
      contact: party.contact,
    })),
  });
});

export const PATCH = withApiHandler<MatterParams>(async (req, { params, session }) => {
  const payload = await req.json();
  const update = matterUpdateSchema.parse(payload);

  const existing = await prisma.matter.findUnique({ where: { id: params!.id } });
  if (!existing) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const userId = session!.user!.id;
  const role = session!.user!.role;

  assertCanModifyResource({
    userRole: role,
    userId,
    resourceOwnerId: existing.ownerId,
  });

  if (update.ownerId && update.ownerId !== existing.ownerId && !isAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.matter.update({
    where: { id: params!.id },
    data: update,
  });

  await recordAuditLog({
    actorId: userId,
    action: "matter.update",
    entityType: "matter",
    entityId: updated.id,
    metadata: { changes: update },
  });

  return NextResponse.json({
    ...updated,
    openedAt: updated.openedAt.toISOString(),
    nextHearingAt: updated.nextHearingAt?.toISOString() ?? null,
  });
});

export const DELETE = withApiHandler<MatterParams>(async (_req, { params, session }) => {
  const existing = await prisma.matter.findUnique({ where: { id: params!.id } });
  if (!existing) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const userId = session!.user!.id;

  assertCanModifyResource({
    userRole: session!.user!.role,
    userId,
    resourceOwnerId: existing.ownerId,
  });

  await prisma.matter.delete({ where: { id: params!.id } });

  await recordAuditLog({
    actorId: userId,
    action: "matter.delete",
    entityType: "matter",
    entityId: existing.id,
    metadata: { title: existing.title },
  });

  return new NextResponse(null, { status: 204 });
});
