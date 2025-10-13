import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  matterCreateSchema,
  matterQuerySchema,
} from "@/lib/validation/matter";
import { withApiHandler } from "@/lib/api-handler";
import { recordAuditLog } from "@/lib/audit";

export const GET = withApiHandler(async (req) => {
  const queryParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const { q, status, type, clientId, page, pageSize } = matterQuerySchema.parse(queryParams);
  const skip = (page - 1) * pageSize;

  const where = {
    ...(q
      ? {
          title: {
            contains: q,
            mode: "insensitive" as const,
          },
        }
      : {}),
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
    ...(clientId ? { clientId } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.matter.findMany({
      where,
      orderBy: { openedAt: "desc" },
      skip,
      take: pageSize,
      include: {
        client: { select: { id: true, firstName: true, lastName: true, email: true } },
        owner: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.matter.count({ where }),
  ]);

  return NextResponse.json({
    data: items.map((item) => ({
      ...item,
      openedAt: item.openedAt.toISOString(),
      nextHearingAt: item.nextHearingAt?.toISOString() ?? null,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      hasNext: skip + pageSize < total,
      hasPrev: page > 1,
    },
  });
});

export const POST = withApiHandler(async (req, { session }) => {
  const payload = await req.json();
  const parsed = matterCreateSchema.parse(payload);
  const ownerId = parsed.ownerId ?? session!.user!.id;

  const created = await prisma.matter.create({
    data: {
      ...parsed,
      ownerId,
    },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  await recordAuditLog({
    actorId: session!.user!.id,
    action: "matter.create",
    entityType: "matter",
    entityId: created.id,
    metadata: { payload: parsed },
  });

  return NextResponse.json({
    id: created.id,
    title: created.title,
    type: created.type,
    status: created.status,
    jurisdiction: created.jurisdiction,
    court: created.court,
    openedAt: created.openedAt.toISOString(),
    nextHearingAt: created.nextHearingAt?.toISOString() ?? null,
    ownerId: created.ownerId,
    client: created.client
      ? {
          id: created.client.id,
          name: `${created.client.firstName} ${created.client.lastName}`.trim(),
        }
      : null,
  }, { status: 201 });
});
