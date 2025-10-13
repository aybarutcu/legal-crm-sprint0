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

  const where: Prisma.DocumentWhereInput = {
    filename: payload.filename,
    matterId: payload.matterId ?? null,
    contactId: payload.contactId ?? null,
  };

  const aggregate = await prisma.document.aggregate({
    _max: { version: true },
    where,
  });

  const nextVersion = getNextDocumentVersion(aggregate._max.version);
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
