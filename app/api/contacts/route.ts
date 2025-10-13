import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  CONTACT_PAGE_SIZE,
  contactCreateSchema,
  contactQuerySchema,
} from "@/lib/validation/contact";
import { recordAuditLog } from "@/lib/audit";
import { withApiHandler } from "@/lib/api-handler";

export const GET = withApiHandler(async (req) => {
  const queryParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const { q, status, type, ownerId, page, pageSize } =
    contactQuerySchema.parse(queryParams);

  const where = {
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
    ...(ownerId ? { ownerId } : {}),
  };

  const skip = (page - 1) * pageSize;
  const take = pageSize ?? CONTACT_PAGE_SIZE;

  const [data, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    prisma.contact.count({ where }),
  ]);

  return NextResponse.json({
    data,
    pagination: {
      page,
      pageSize: take,
      total,
      totalPages: Math.max(1, Math.ceil(total / take)),
      hasNext: skip + take < total,
      hasPrev: page > 1,
    },
  });
});

export const POST = withApiHandler(async (req, { session }) => {
  const payload = await req.json();
  const { ownerId, tags, ...data } = contactCreateSchema.parse(payload);
  const userId = session!.user!.id;
  const normalizedTags = tags ?? [];

  const created = await prisma.contact.create({
    data: {
      ...data,
      ownerId: ownerId ?? userId,
      tags: normalizedTags,
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
    },
  });

  await recordAuditLog({
    actorId: userId,
    action: "contact.create",
    entityType: "contact",
    entityId: created.id,
    metadata: {
      payload: {
        ownerId: ownerId ?? userId,
        tags: normalizedTags,
        ...data,
      },
    },
  });

  return NextResponse.json(created, { status: 201 });
});
