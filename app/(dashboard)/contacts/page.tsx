import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  CONTACT_PAGE_SIZE,
  contactQuerySchema,
} from "@/lib/validation/contact";
import { ContactsPageClient } from "@/components/contact/contacts-page-client";
import type { ContactListItem } from "@/components/contact/types";

export default async function ContactsPage({
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
    type: Array.isArray(resolvedSearchParams.type)
      ? resolvedSearchParams.type[0]
      : resolvedSearchParams.type,
    status: Array.isArray(resolvedSearchParams.status)
      ? resolvedSearchParams.status[0]
      : resolvedSearchParams.status,
    ownerId: Array.isArray(resolvedSearchParams.ownerId)
      ? resolvedSearchParams.ownerId[0]
      : resolvedSearchParams.ownerId,
    page: Array.isArray(resolvedSearchParams.page)
      ? resolvedSearchParams.page[0]
      : resolvedSearchParams.page,
    pageSize: Array.isArray(resolvedSearchParams.pageSize)
      ? resolvedSearchParams.pageSize[0]
      : resolvedSearchParams.pageSize,
  };

  const parsedQuery = contactQuerySchema.safeParse(rawQuery);
  if (!parsedQuery.success) {
    redirect(`/contacts?page=1&pageSize=${CONTACT_PAGE_SIZE}`);
  }

  const { q, type, status, ownerId, page, pageSize } = parsedQuery.data;

  const where = {
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { lastName: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { email: { contains: q, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {}),
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...(ownerId ? { ownerId } : {}),
  };

  const skip = (page - 1) * pageSize;

  const [contacts, total, owners] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    }) as any,
    prisma.contact.count({ where }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const contactsSerialized: ContactListItem[] = contacts.map((contact: any) => ({
    id: contact.id,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    company: contact.company,
    type: contact.type,
    status: contact.status,
    tags: contact.tags,
    ownerId: contact.ownerId,
    owner: contact.owner
      ? {
          id: contact.owner.id,
          name: contact.owner.name,
          email: contact.owner.email,
        }
      : null,
    createdAt: contact.createdAt.toISOString(),
  }));

  const pagination = {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    hasNext: skip + pageSize < total,
    hasPrev: page > 1,
  };

  const ownerOptions = owners.map((owner) => ({
    id: owner.id,
    name: owner.name,
    email: owner.email,
  }));

  return (
    <ContactsPageClient
      initialContacts={contactsSerialized}
      owners={ownerOptions}
      initialPagination={pagination}
      filters={{ q: q ?? undefined, type, status, ownerId }}
    />
  );
}
