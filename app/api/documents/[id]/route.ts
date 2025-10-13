import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteObject, moveObject } from "@/lib/storage";
import { recordAuditLog } from "@/lib/audit";
import { z } from "zod";

const documentUpdateSchema = z
  .object({
    tags: z.array(z.string()).optional(),
    matterId: z.string().optional().nullable(),
    version: z.number().int().positive().optional(),
    signedAt: z.string().datetime().optional().nullable(),
    filename: z.string().min(1).optional(),
  })
  .strict();

type RouteContext = { params: { id: string } | Promise<{ id: string }> };

export async function GET(_: NextRequest, context: RouteContext) {
  const { id } = await Promise.resolve(context.params);

  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      matter: { select: { id: true, title: true } },
      contact: {
        select: { id: true, firstName: true, lastName: true },
      },
      uploader: { select: { id: true, name: true, email: true } },
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  return NextResponse.json(document);
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await Promise.resolve(context.params);

  const body = await req.json();
  const parsed = documentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await prisma.document.findUnique({
    where: { id },
    include: {
      matter: { select: { id: true, title: true } },
      contact: {
        select: { id: true, firstName: true, lastName: true },
      },
      uploader: { select: { id: true, name: true, email: true } },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const { signedAt, filename, tags, matterId, version } = parsed.data;

  const data: Record<string, unknown> = {};

  if (Array.isArray(tags)) {
    data.tags = tags;
  }

  if (matterId !== undefined) {
    data.matterId = matterId;
  }

  if (version !== undefined) {
    data.version = version;
  }

  if (signedAt !== undefined) {
    data.signedAt = signedAt ? new Date(signedAt) : null;
  }

  let targetStorageKey = existing.storageKey;

  if (filename && filename !== existing.filename) {
    const newStorageKey = `documents/${existing.id}/v${existing.version}/${filename}`;
    try {
      const moved = await moveObject({
        sourceKey: existing.storageKey,
        destinationKey: newStorageKey,
      });
      if (moved) {
        targetStorageKey = newStorageKey;
      }
    } catch (error) {
      console.error("Failed to rename object in storage", {
        error,
        documentId: existing.id,
        sourceKey: existing.storageKey,
        destinationKey: newStorageKey,
      });
      return NextResponse.json(
        { error: "Unable to rename document in storage" },
        { status: 502 },
      );
    }

    data.filename = filename;
    if (targetStorageKey !== existing.storageKey) {
      data.storageKey = targetStorageKey;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(existing);
  }

  const updated = await prisma.document.update({
    where: { id },
    data,
    include: {
      matter: { select: { id: true, title: true } },
      contact: {
        select: { id: true, firstName: true, lastName: true },
      },
      uploader: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await Promise.resolve(context.params);

  const document = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true,
      storageKey: true,
      filename: true,
      version: true,
      matterId: true,
      contactId: true,
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  try {
    await deleteObject({ key: document.storageKey });
  } catch (error) {
    console.error("Failed to delete object from storage", {
      error,
      key: document.storageKey,
    });
    return NextResponse.json(
      { error: "Unable to delete file from storage" },
      { status: 502 },
    );
  }

  await prisma.document.delete({ where: { id } });

  await recordAuditLog({
    actorId: session.user.id,
    action: "document.delete",
    entityType: "document",
    entityId: document.id,
    metadata: {
      filename: document.filename,
      version: document.version,
      matterId: document.matterId,
      contactId: document.contactId,
    },
  });
  return new NextResponse(null, { status: 204 });
}
