import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { DocumentsPageClient } from "@/components/documents/DocumentsPageClient";
import type {
  DocumentListItem,
  MatterOption,
  ContactOption,
  UploaderOption,
} from "@/components/documents/types";
import { documentQuerySchema, MAX_UPLOAD_BYTES } from "@/lib/validation/document";

export default async function DocumentsPage({
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
    matterId: Array.isArray(resolvedSearchParams.matterId)
      ? resolvedSearchParams.matterId[0]
      : resolvedSearchParams.matterId,
    contactId: Array.isArray(resolvedSearchParams.contactId)
      ? resolvedSearchParams.contactId[0]
      : resolvedSearchParams.contactId,
    folderId: Array.isArray(resolvedSearchParams.folderId)
      ? resolvedSearchParams.folderId[0]
      : resolvedSearchParams.folderId,
    uploaderId: Array.isArray(resolvedSearchParams.uploaderId)
      ? resolvedSearchParams.uploaderId[0]
      : resolvedSearchParams.uploaderId,
    tags: Array.isArray(resolvedSearchParams.tags)
      ? resolvedSearchParams.tags[0]
      : resolvedSearchParams.tags,
    page: Array.isArray(resolvedSearchParams.page)
      ? resolvedSearchParams.page[0]
      : resolvedSearchParams.page,
    pageSize: Array.isArray(resolvedSearchParams.pageSize)
      ? resolvedSearchParams.pageSize[0]
      : resolvedSearchParams.pageSize,
  };

  const parsed = documentQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    redirect(`/documents?page=1&pageSize=20`);
  }

  const { q, matterId, contactId, folderId, uploaderId, tags, page, pageSize } = parsed.data;
  const skip = (page - 1) * pageSize;
  const tagList = tags
    ? tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];

  const where = {
    ...(matterId ? { matterId } : {}),
    ...(contactId ? { contactId } : {}),
    ...(folderId ? { folderId } : {}),
    ...(uploaderId ? { uploaderId } : {}),
    ...(tagList.length ? { tags: { hasSome: tagList } } : {}),
    ...(q
      ? {
          OR: [
            { filename: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { tags: { has: q } },
          ],
        }
      : {}),
  };

  // Fetch ALL documents matching the filter (not paginated yet)
  const allDocuments = await prisma.document.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      filename: true,
      displayName: true,
      mime: true,
      size: true,
      version: true,
      parentDocumentId: true,
      tags: true,
      storageKey: true,
      hash: true,
      createdAt: true,
      signedAt: true,
      workflowStepId: true,
      folderId: true,
      matter: { select: { id: true, title: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      uploader: { select: { id: true, name: true, email: true } },
    },
  }) as any;

  // Group by root document and keep only latest version
  const latestVersionsMap = new Map<string, typeof allDocuments[0]>();
  
  for (const doc of allDocuments) {
    const rootId = doc.parentDocumentId || doc.id;
    const existing = latestVersionsMap.get(rootId);
    
    if (!existing || doc.version > existing.version) {
      latestVersionsMap.set(rootId, doc);
    }
  }
  
  // Convert map to array and apply pagination
  const groupedDocuments = Array.from(latestVersionsMap.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(skip, skip + pageSize);
    
  const total = latestVersionsMap.size;
  const documents = groupedDocuments;

  const [matters, contacts, uploaders] = await Promise.all([
    prisma.matter.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true },
      take: 100,
    }),
    prisma.contact.findMany({
      orderBy: { firstName: "asc" },
      select: { id: true, firstName: true, lastName: true, email: true },
      take: 100,
    }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const documentItems: DocumentListItem[] = documents.map((doc: any) => ({
    id: doc.id,
    filename: doc.filename,
    displayName: doc.displayName,
    mime: doc.mime,
    size: doc.size,
    version: doc.version,
    tags: doc.tags,
    storageKey: doc.storageKey,
    hash: doc.hash ?? null,
    folderId: doc.folderId ?? null,
    createdAt: doc.createdAt.toISOString(),
    signedAt: doc.signedAt?.toISOString() ?? null,
    workflowStepId: doc.workflowStepId ?? null,
    matter: doc.matter,
    contact: doc.contact,
    uploader: doc.uploader,
  }));

  const matterOptions: MatterOption[] = matters.map((matter) => ({
    id: matter.id,
    title: matter.title,
  }));

  const contactOptions: ContactOption[] = contacts.map((contact) => ({
    id: contact.id,
    name: `${contact.firstName} ${contact.lastName}`.trim(),
    email: contact.email,
  }));

  const uploaderOptions: UploaderOption[] = uploaders.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
  }));

  return (
    <DocumentsPageClient
      documents={documentItems}
      matters={matterOptions}
      contacts={contactOptions}
      uploaders={uploaderOptions}
      pagination={{
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        hasNext: skip + pageSize < total,
        hasPrev: page > 1,
      }}
      filters={{ q, matterId, contactId, folderId, uploaderId, tags }}
      maxUploadBytes={MAX_UPLOAD_BYTES}
    />
  );
}

export const dynamic = "force-dynamic";
