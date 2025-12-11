import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import {
  MAX_UPLOAD_BYTES,
  documentUploadSchema,
} from "@/lib/validation/document";
import { createSignedUploadUrl } from "@/lib/storage";
import { getNextDocumentVersion } from "@/lib/documents/version";

const UPLOAD_URL_TTL = parseInt(process.env.SIGNED_URL_TTL_SECONDS ?? "300", 10);

export const POST = withApiHandler(async (req) => {
  const body = await req.json();
  const payload = documentUploadSchema.parse(body);

  if (payload.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "File size exceeds limit" },
      { status: 413 },
    );
  }

  // Version calculation based on displayName + folder location
  // OR based on parentDocumentId if provided (for explicit versioning)
  let nextVersion: number;
  
  if (payload.parentDocumentId) {
    // Versioning an existing document - get versions of the parent
    const parentDoc = await prisma.document.findUnique({
      where: { id: payload.parentDocumentId },
      select: { 
        id: true,
        displayName: true,
        folderId: true,
        matterId: true,
        contactId: true,
        parentDocumentId: true, // If parent is itself a version, get root
      },
    });

    if (!parentDoc) {
      return NextResponse.json(
        { error: "Parent document not found" },
        { status: 404 },
      );
    }

    // Find all versions of this document (including parent and its versions)
    const rootDocId = parentDoc.parentDocumentId || parentDoc.id;
    const aggregate = await prisma.document.aggregate({
      _max: { version: true },
      where: {
        OR: [
          { id: rootDocId },
          { parentDocumentId: rootDocId },
        ],
        deletedAt: null,
      },
    });

    nextVersion = getNextDocumentVersion(aggregate._max.version);
  } else {
    // New document - check for existing documents with same displayName
    const where: Prisma.DocumentWhereInput = {
      displayName: payload.displayName ?? payload.filename, // Use displayName if provided, fallback to filename
      folderId: payload.folderId ?? null,
      matterId: payload.matterId ?? null,
      contactId: payload.contactId ?? null,
      deletedAt: null, // Only consider active documents
    };

    const aggregate = await prisma.document.aggregate({
      _max: { version: true },
      where,
    });

    nextVersion = getNextDocumentVersion(aggregate._max.version);
  }
  const documentId = randomUUID();
  const storageKey = `documents/${documentId}/v${nextVersion}/${payload.filename}`;

  const putUrl = await createSignedUploadUrl({
    key: storageKey,
    contentType: payload.mime,
    expiresIn: UPLOAD_URL_TTL,
  });

  const uploadTarget = {
    url: putUrl,
    method: "PUT" as const,
    fields: null,
  };

  return NextResponse.json({
    documentId,
    storageKey,
    version: nextVersion,
    upload: uploadTarget,
    putUrl,
    method: uploadTarget.method,
    expiresAt: new Date(Date.now() + UPLOAD_URL_TTL * 1000).toISOString(),
  });
});
