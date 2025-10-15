import { NextResponse } from "next/server";
import { ParentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { contactUpdateSchema } from "@/lib/validation/contact";
import { recordAuditLog } from "@/lib/audit";
import { withApiHandler } from "@/lib/api-handler";
import { assertCanModifyResource, isAdmin } from "@/lib/authorization";

type ContactParams = {
  id: string;
};

export const GET = withApiHandler<ContactParams>(async (_req, { params }) => {
  const contact = await prisma.contact.findUnique({
    where: { id: params!.id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          invitedAt: true,
          activatedAt: true,
          isActive: true,
        },
      },
    },
  });

  if (!contact) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const [relatedMatters, notes] = await Promise.all([
    prisma.matterContact.findMany({
      where: { contactId: params!.id },
      include: {
        matter: {
          select: { id: true, title: true, status: true, openedAt: true },
        },
      },
    }),
    prisma.note.findMany({
      where: { parentType: ParentType.CONTACT, parentId: params!.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return NextResponse.json({
    ...contact,
    matters: relatedMatters.map((item) => ({
      id: item.matter.id,
      title: item.matter.title,
      status: item.matter.status,
      openedAt: item.matter.openedAt,
      role: item.role,
    })),
    notes,
  });
});

export const PATCH = withApiHandler<ContactParams>(
  async (req, { params, session }) => {
    const payload = await req.json();
    const update = contactUpdateSchema.parse(payload);

    const existing = await prisma.contact.findUnique({
      where: { id: params!.id },
    });

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

    const updated = await prisma.contact.update({
      where: { id: params!.id },
      data: update,
    });

    await recordAuditLog({
      actorId: userId,
      action: "contact.update",
      entityType: "contact",
      entityId: updated.id,
      metadata: { changes: update },
    });

    return NextResponse.json(updated);
  },
);

export const DELETE = withApiHandler<ContactParams>(
  async (_req, { params, session }) => {
    const existing = await prisma.contact.findUnique({ where: { id: params!.id } });

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

    const deleted = await prisma.contact.delete({ where: { id: params!.id } });

    await recordAuditLog({
      actorId: userId,
      action: "contact.delete",
      entityType: "contact",
      entityId: deleted.id,
      metadata: { email: deleted.email },
    });

    return new NextResponse(null, { status: 204 });
  },
);
