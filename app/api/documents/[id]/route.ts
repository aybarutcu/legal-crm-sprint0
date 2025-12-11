import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteObject, moveObject } from "@/lib/storage";
import { recordAuditLog } from "@/lib/audit";
import { assertMatterAccess, assertContactAccess } from "@/lib/authorization";
import { checkDocumentAccess } from "@/lib/documents/access-control";
import { findDocumentFamilyById } from "@/lib/documents/family";
import { z } from "zod";

const documentUpdateSchema = z
  .object({
    tags: z.array(z.string()).optional(),
    displayName: z.string().optional().nullable(),
    matterId: z.string().optional().nullable(),
    folderId: z.string().optional().nullable(),
    version: z.number().int().positive().optional(),
    signedAt: z.string().datetime().optional().nullable(),
    filename: z.string().min(1).optional(),
  })
  .strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await Promise.resolve(context.params);
  const user = session.user;

  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      matter: { select: { id: true, title: true } },
      contact: {
        select: { id: true, firstName: true, lastName: true },
      },
      uploader: { select: { id: true, name: true, email: true } },
      workflowStep: {
        select: {
          instance: {
            select: {
              matterId: true,
              contactId: true,
            },
          },
        },
      },
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  // Check granular document access control
  const accessCheck = await checkDocumentAccess(
    {
      id: document.id,
      uploaderId: document.uploaderId,
      accessScope: document.accessScope,
      accessMetadata: document.accessMetadata as Record<string, unknown> | null,
      matterId: document.matterId,
      contactId: document.contactId,
    },
    { userId: user.id, userRole: user.role! }
  );

  if (!accessCheck.hasAccess) {
    return NextResponse.json(
      { error: "Access denied", reason: accessCheck.reason },
      { status: 403 }
    );
  }

  // Legacy matter/contact access control (for backward compatibility)
  if (document.matterId) {
    await assertMatterAccess(user, document.matterId);
  } else if (document.contactId) {
    await assertContactAccess(user, document.contactId);
  } else if (document.workflowStep?.instance.matterId) {
    await assertMatterAccess(user, document.workflowStep.instance.matterId);
  } else if (document.workflowStep?.instance.contactId) {
    await assertContactAccess(user, document.workflowStep.instance.contactId);
  }

  return NextResponse.json(document);
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await Promise.resolve(context.params);
  const user = session.user;

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
      workflowStep: {
        select: {
          instance: {
            select: {
              matterId: true,
              contactId: true,
            },
          },
        },
      },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  // Access control
  if (existing.matterId) {
    await assertMatterAccess(user, existing.matterId);
  } else if (existing.contactId) {
    await assertContactAccess(user, existing.contactId);
  } else if (existing.workflowStep?.instance.matterId) {
    await assertMatterAccess(user, existing.workflowStep.instance.matterId);
  } else if (existing.workflowStep?.instance.contactId) {
    await assertContactAccess(user, existing.workflowStep.instance.contactId);
  }

  const { signedAt, filename, tags, displayName, matterId, folderId, version } = parsed.data;

  const data: Record<string, unknown> = {};

  if (Array.isArray(tags)) {
    data.tags = tags;
  }

  // Handle displayName change - affects all versions
  let documentFamily: Awaited<ReturnType<typeof findDocumentFamilyById>> = [];
  if (displayName !== undefined && displayName !== existing.displayName) {
    documentFamily = await findDocumentFamilyById(id);
    
    // Update displayName for all versions
    await prisma.document.updateMany({
      where: {
        id: { in: documentFamily.map(d => d.id) },
      },
      data: { displayName },
    });
  } else if (displayName !== undefined) {
    data.displayName = displayName;
  }

  if (matterId !== undefined) {
    data.matterId = matterId;
  }

  if (folderId !== undefined) {
    data.folderId = folderId;
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

  // Log audit with family info if displayName was changed
  if (displayName !== undefined && displayName !== existing.displayName && documentFamily.length > 0) {
    await recordAuditLog({
      actorId: user.id,
      action: "document.update",
      entityType: "document",
      entityId: updated.id,
      metadata: {
        oldDisplayName: existing.displayName,
        newDisplayName: displayName,
        versionsRenamedCount: documentFamily.length,
        versionsRenamed: documentFamily.map(d => d.version),
      },
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await Promise.resolve(context.params);
  const user = session.user;

  const document = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true,
      storageKey: true,
      filename: true,
      displayName: true,
      version: true,
      matterId: true,
      contactId: true,
      workflowStepId: true,
      workflowStep: {
        select: {
          instance: {
            select: {
              matterId: true,
              contactId: true,
            },
          },
        },
      },
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  // Access control
  if (document.matterId) {
    await assertMatterAccess(user, document.matterId);
  } else if (document.contactId) {
    await assertContactAccess(user, document.contactId);
  } else if (document.workflowStep?.instance.matterId) {
    await assertMatterAccess(user, document.workflowStep.instance.matterId);
  } else if (document.workflowStep?.instance.contactId) {
    await assertContactAccess(user, document.workflowStep.instance.contactId);
  }

  // Find all versions of this document
  const documentFamily = await findDocumentFamilyById(id);

  // Delete all versions from storage
  const deletionResults = await Promise.allSettled(
    documentFamily.map((doc) =>
      deleteObject({ key: doc.storageKey }).catch((error) => {
        console.error("Failed to delete object from storage", {
          error,
          key: doc.storageKey,
          documentId: doc.id,
        });
        throw error;
      })
    )
  );

  // Check if any deletions failed
  const failedDeletions = deletionResults.filter(
    (result) => result.status === "rejected"
  );
  
  if (failedDeletions.length > 0) {
    console.error(`Failed to delete ${failedDeletions.length} of ${documentFamily.length} files from storage`);
    return NextResponse.json(
      { error: "Unable to delete some files from storage" },
      { status: 502 },
    );
  }

  // Delete all versions from database
  await prisma.document.deleteMany({
    where: { 
      id: { in: documentFamily.map(d => d.id) }
    },
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: "document.delete",
    entityType: "document",
    entityId: document.id,
    metadata: {
      displayName: document.displayName,
      filename: document.filename,
      version: document.version,
      matterId: document.matterId,
      contactId: document.contactId,
      versionsDeletedCount: documentFamily.length,
      versionsDeleted: documentFamily.map(d => d.version),
    },
  });
  
  return new NextResponse(null, { status: 204 });
}
