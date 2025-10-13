import { NextResponse } from "next/server";
import { Buffer } from "node:buffer";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import {
  MAX_UPLOAD_BYTES,
  documentCreateSchema,
  documentQuerySchema,
} from "@/lib/validation/document";
import { recordAuditLog } from "@/lib/audit";
import { detectMimeFromBuffer, isMimeCompatible } from "@/lib/mime-sniffer";
import { readObjectChunk, calculateObjectHash } from "@/lib/storage";
import { getNextDocumentVersion } from "@/lib/documents/version";

export const GET = withApiHandler(async (req) => {
  const queryParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const { q, matterId, contactId, uploaderId, tags, page, pageSize } =
    documentQuerySchema.parse(queryParams);

  const skip = (page - 1) * pageSize;
  const tagList = tags
    ? tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];

  const where: Prisma.DocumentWhereInput = {
    ...(matterId ? { matterId } : {}),
    ...(contactId ? { contactId } : {}),
    ...(uploaderId ? { uploaderId } : {}),
  };

  if (tagList.length) {
    where.tags = { hasSome: tagList };
  }

  if (q) {
    where.OR = [
      { filename: { contains: q, mode: "insensitive" } },
      { tags: { has: q } },
    ];
  }

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        matter: { select: { id: true, title: true } },
        contact: {
          select: { id: true, firstName: true, lastName: true },
        },
        uploader: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    prisma.document.count({ where }),
  ]);

  return NextResponse.json({
    data: documents.map((doc) => ({
      ...doc,
      createdAt: doc.createdAt.toISOString(),
      signedAt: doc.signedAt?.toISOString() ?? null,
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
  const body = await req.json();
  const payload = documentCreateSchema.parse(body);

  if (payload.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File size exceeds limit" }, { status: 413 });
  }

  const where: Prisma.DocumentWhereInput = {
    filename: payload.filename,
    matterId: payload.matterId ?? null,
    contactId: payload.contactId ?? null,
  };

  const aggregate = await prisma.document.aggregate({
    _max: { version: true },
    where,
  });
  const expectedVersion = getNextDocumentVersion(aggregate._max.version);
  const version = payload.version ?? expectedVersion;

  if (version !== expectedVersion) {
    return NextResponse.json({ error: "Version mismatch" }, { status: 409 });
  }

  const expectedStorageKey = `documents/${payload.documentId}/v${version}/${payload.filename}`;
  if (payload.storageKey !== expectedStorageKey) {
    return NextResponse.json({ error: "Invalid storage key" }, { status: 400 });
  }

  let objectChunk: Buffer;
  try {
    objectChunk = await readObjectChunk({ key: payload.storageKey });
  } catch {
    return NextResponse.json(
      { error: "Uploaded file could not be accessed" },
      { status: 400 },
    );
  }

  if (!objectChunk.length) {
    return NextResponse.json(
      { error: "Uploaded file is empty or unavailable" },
      { status: 400 },
    );
  }

  const detectedMime = detectMimeFromBuffer(objectChunk);

  if (!isMimeCompatible(payload.mime, detectedMime)) {
    return NextResponse.json(
      {
        error:
          "Uploaded content does not match the declared MIME type. Upload aborted.",
      },
      { status: 415 },
    );
  }

  let objectHash: string | null = null;
  try {
    objectHash = await calculateObjectHash({ key: payload.storageKey });
  } catch (error) {
    console.error("Failed to calculate document hash", {
      error,
      storageKey: payload.storageKey,
    });
    return NextResponse.json(
      { error: "Unable to calculate file hash" },
      { status: 400 },
    );
  }

  if (payload.matterId) {
    const duplicate = await prisma.document.findFirst({
      where: {
        matterId: payload.matterId,
        hash: objectHash,
      },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: "This file already exists for the selected matter." },
        { status: 409 },
      );
    }
  }

  const created = await prisma.document.create({
    data: {
      id: payload.documentId,
      filename: payload.filename,
      mime: payload.mime,
      size: payload.size,
      storageKey: payload.storageKey,
      hash: objectHash,
      tags: payload.tags ?? [],
      version,
      matterId: payload.matterId ?? null,
      contactId: payload.contactId ?? null,
      uploaderId: session!.user!.id,
    },
    include: {
      matter: { select: { id: true, title: true } },
      contact: {
        select: { id: true, firstName: true, lastName: true },
      },
      uploader: {
        select: { id: true, name: true, email: true } },
    },
  });

  await recordAuditLog({
    actorId: session!.user!.id,
    action: version === 1 ? "document.create" : "document.version",
    entityType: "document",
    entityId: created.id,
    metadata: {
      filename: created.filename,
      version,
      matterId: created.matterId,
      contactId: created.contactId,
    },
  });

  return NextResponse.json({
    ...created,
    createdAt: created.createdAt.toISOString(),
    signedAt: created.signedAt?.toISOString() ?? null,
  }, { status: 201 });
});
