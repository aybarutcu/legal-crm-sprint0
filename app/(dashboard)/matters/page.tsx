import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { matterQuerySchema } from "@/lib/validation/matter";
import { MattersPageClient } from "@/components/matters/MattersPageClient";
import type { ContactOption, MatterListItem } from "@/components/matters/types";

const PAGE_SIZE = 20;

export default async function MattersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;
  const rawQuery = {
    q: Array.isArray(resolvedSearchParams.q)
      ? resolvedSearchParams.q[0]
      : resolvedSearchParams.q,
    status: Array.isArray(resolvedSearchParams.status)
      ? resolvedSearchParams.status[0]
      : resolvedSearchParams.status,
    type: Array.isArray(resolvedSearchParams.type)
      ? resolvedSearchParams.type[0]
      : resolvedSearchParams.type,
    clientId: Array.isArray(resolvedSearchParams.clientId)
      ? resolvedSearchParams.clientId[0]
      : resolvedSearchParams.clientId,
    page: Array.isArray(resolvedSearchParams.page)
      ? resolvedSearchParams.page[0]
      : resolvedSearchParams.page,
    pageSize: Array.isArray(resolvedSearchParams.pageSize)
      ? resolvedSearchParams.pageSize[0]
      : resolvedSearchParams.pageSize,
  };

  const parsed = matterQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    redirect(`/matters?page=1&pageSize=${PAGE_SIZE}`);
  }

  const { q, status, type, clientId, page, pageSize } = parsed.data;
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

  const [matters, total, clients] = await Promise.all([
    prisma.matter.findMany({
      where,
      orderBy: { openedAt: "desc" },
      skip,
      take: pageSize,
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.matter.count({ where }),
    prisma.contact.findMany({
      orderBy: { firstName: "asc" },
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
  ]);

  const matterItems: MatterListItem[] = matters.map((matter) => ({
    id: matter.id,
    title: matter.title,
    type: matter.type,
    status: matter.status,
    jurisdiction: matter.jurisdiction,
    court: matter.court,
    openedAt: matter.openedAt.toISOString(),
    nextHearingAt: matter.nextHearingAt?.toISOString() ?? null,
    ownerId: matter.ownerId,
    client: matter.client
      ? {
          id: matter.client.id,
          name: `${matter.client.firstName} ${matter.client.lastName}`.trim(),
        }
      : null,
  }));

  const clientOptions: ContactOption[] = clients.map((client) => ({
    id: client.id,
    name: `${client.firstName} ${client.lastName}`.trim(),
    email: client.email,
  }));

  return (
    <MattersPageClient
      matters={matterItems}
      clients={clientOptions}
      pagination={{
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        hasNext: skip + pageSize < total,
        hasPrev: page > 1,
      }}
      filters={{ q: q ?? undefined, status, type, clientId }}
    />
  );
}

export const dynamic = "force-dynamic";
