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
import { assertMatterAccess, assertContactAccess } from "@/lib/authorization";

export const GET = withApiHandler(
  async (req) => {
    const queryParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const { q, matterId, contactId, folderId, uploaderId, tags, page, pageSize } =
      documentQuerySchema.parse(queryParams);

  const skip = (page - 1) * pageSize;
  const tagList = tags
    ? tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];

  const where: Prisma.DocumentWhereInput = {
    deletedAt: null, // Only show non-deleted documents
    ...(matterId ? { matterId } : {}),
    ...(contactId ? { contactId } : {}),
    ...(uploaderId ? { uploaderId } : {}),
    // If no folderId param and no search query, show only root documents (folderId: null)
    // This prevents showing documents from master folders on the root view
    // BUT if there's a search query, search all documents regardless of folder
    ...(folderId !== undefined
      ? folderId === "null" || folderId === ""
        ? { folderId: null }
        : { folderId }
      : q 
        ? {} // When searching, don't filter by folder - search everywhere
        : { folderId: null }), // When not searching, only show root documents
  };

  if (tagList.length) {
    where.tags = { hasSome: tagList };
  }

  if (q) {
    // For search, we need to find documents where:
    // 1. filename contains the search term
    // 2. displayName contains the search term
    // 3. OR at least one tag contains the search term (substring match)
    const searchLower = q.toLowerCase();
    
    // Build the tag search query with all existing filters
    const tagSearchConditions: string[] = ['"deletedAt" IS NULL'];
    const tagSearchParams: any[] = [];
    
    if (matterId) {
      tagSearchConditions.push('"matterId" = $' + (tagSearchParams.length + 1));
      tagSearchParams.push(matterId);
    }
    if (contactId) {
      tagSearchConditions.push('"contactId" = $' + (tagSearchParams.length + 1));
      tagSearchParams.push(contactId);
    }
    if (uploaderId) {
      tagSearchConditions.push('"uploaderId" = $' + (tagSearchParams.length + 1));
      tagSearchParams.push(uploaderId);
    }
    // Add folder filter based on the same logic as main query
    if (folderId !== undefined) {
      if (folderId === "null" || folderId === "") {
        tagSearchConditions.push('"folderId" IS NULL');
      } else {
        tagSearchConditions.push('"folderId" = $' + (tagSearchParams.length + 1));
        tagSearchParams.push(folderId);
      }
    }
    // Don't add folderId filter when searching (same as main logic)
    
    const tagQuery = `
      SELECT id 
      FROM "Document"
      WHERE ${tagSearchConditions.join(' AND ')}
      AND EXISTS (
        SELECT 1 
        FROM unnest(tags) AS tag 
        WHERE LOWER(tag) LIKE $${tagSearchParams.length + 1}
      )
    `;
    tagSearchParams.push('%' + searchLower + '%');

    const docsWithMatchingTags = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      tagQuery,
      ...tagSearchParams
    );

    const matchingTagDocIds = docsWithMatchingTags.map(d => d.id);

    // Combine filename/displayName search with tag search
    where.OR = [
      { filename: { contains: q, mode: "insensitive" } },
      { displayName: { contains: q, mode: "insensitive" } },
      ...(matchingTagDocIds.length > 0 ? [{ id: { in: matchingTagDocIds } }] : []),
    ];
  }

  // To show only latest versions, we use a subquery approach:
  // 1. Get all documents matching the filter
  // 2. Group by root document ID and keep only the highest version
  
  const allDocuments = await prisma.document.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      matter: { select: { id: true, title: true } },
      contact: {
        select: { id: true, firstName: true, lastName: true },
      },
      uploader: {
        select: { id: true, name: true, email: true },
      },
      folder: {
        select: { id: true, name: true, color: true },
      },
    },
  });
  
  // Group by root document and keep only latest version
  const latestVersionsMap = new Map<string, typeof allDocuments[0]>();
  
  for (const doc of allDocuments) {
    const rootId = doc.parentDocumentId || doc.id;
    const existing = latestVersionsMap.get(rootId);
    
    if (!existing || doc.version > existing.version) {
      latestVersionsMap.set(rootId, doc);
    }
  }
  
  const documents = Array.from(latestVersionsMap.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(skip, skip + pageSize);
    
  const total = latestVersionsMap.size;

    return NextResponse.json({
      data: documents.map((doc) => ({
        ...doc,
        createdAt: doc.createdAt.toISOString(),
        signedAt: doc.signedAt?.toISOString() ?? null,
        workflowStepId: doc.workflowStepId,
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
  },
  { requireAuth: true }
);

export const POST = withApiHandler(async (req, { session }) => {
  const body = await req.json();
  const payload = documentCreateSchema.parse(body);

  const user = session!.user!;

  if (payload.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File size exceeds limit" }, { status: 413 });
  }

  // Access control: Verify user has access to the matter/contact
  if (payload.matterId) {
    await assertMatterAccess(user, payload.matterId);
  }
  if (payload.contactId) {
    await assertContactAccess(user, payload.contactId);
  }

  // If linked to workflow step, verify access through matter/contact
  if (payload.workflowStepId) {
    const workflowStep = await prisma.workflowInstanceStep.findUnique({
      where: { id: payload.workflowStepId },
      include: {
        instance: {
          select: {
            matterId: true,
            contactId: true,
          },
        },
      },
    });

    if (!workflowStep) {
      return NextResponse.json(
        { error: "Workflow step not found" },
        { status: 404 }
      );
    }

    // Verify access through workflow's matter/contact
    if (workflowStep.instance.matterId) {
      await assertMatterAccess(user, workflowStep.instance.matterId);
    }
    if (workflowStep.instance.contactId) {
      await assertContactAccess(user, workflowStep.instance.contactId);
    }
  }

  // Auto-assign to matter's folder if matterId is provided and no folderId specified
  let targetFolderId = payload.folderId ?? null;
  if (payload.matterId && !targetFolderId) {
    // Find or create the matter's folder
    const mattersRootFolder = await prisma.documentFolder.findFirst({
      where: {
        name: "Matters",
        parentFolderId: null,
        matterId: null,
        contactId: null,
        deletedAt: null,
      },
    });

    let matterFolder;
    if (mattersRootFolder) {
      // Try to find the matter's folder
      matterFolder = await prisma.documentFolder.findFirst({
        where: {
          matterId: payload.matterId,
          parentFolderId: mattersRootFolder.id,
          deletedAt: null,
        },
      });

      // If not found, create it
      if (!matterFolder) {
        const matter = await prisma.matter.findUnique({
          where: { id: payload.matterId },
          select: { title: true },
        });

        if (matter) {
          matterFolder = await prisma.documentFolder.create({
            data: {
              name: matter.title,
              matterId: payload.matterId,
              parentFolderId: mattersRootFolder.id,
              createdById: user.id,
              accessScope: "PUBLIC",
              color: "blue",
              isMasterFolder: true, // This is a master folder for the matter
            },
          });
        }
      }
    }

    if (matterFolder) {
      targetFolderId = matterFolder.id;
    }
  }

  // Auto-assign to contact's folder if contactId is provided and no folderId specified
  if (payload.contactId && !targetFolderId) {
    // Find or create the "Contacts" root folder
    let contactsRootFolder = await prisma.documentFolder.findFirst({
      where: {
        name: "Contacts",
        parentFolderId: null,
        matterId: null,
        contactId: null,
        deletedAt: null,
      },
    });

    if (!contactsRootFolder) {
      contactsRootFolder = await prisma.documentFolder.create({
        data: {
          name: "Contacts",
          createdById: user.id,
          accessScope: "PUBLIC",
        },
      });
    }

    // Find or create contact-specific folder
    let contactFolder = await prisma.documentFolder.findFirst({
      where: {
        contactId: payload.contactId,
        parentFolderId: contactsRootFolder.id,
        deletedAt: null,
      },
    });

    if (!contactFolder) {
      const contact = await prisma.contact.findUnique({
        where: { id: payload.contactId },
        select: { firstName: true, lastName: true },
      });

      if (contact) {
        const contactName = `${contact.firstName} ${contact.lastName}`.trim();
        contactFolder = await prisma.documentFolder.create({
          data: {
            name: contactName,
            contactId: payload.contactId,
            parentFolderId: contactsRootFolder.id,
            createdById: user.id,
            accessScope: "PUBLIC",
            color: "green",
            isMasterFolder: true, // This is a master folder for the contact
          },
        });
      }
    }

    if (contactFolder) {
      targetFolderId = contactFolder.id;
    }
  }

  // Version validation based on displayName + folder location
  const where: Prisma.DocumentWhereInput = {
    displayName: payload.displayName ?? payload.filename,
    folderId: targetFolderId,
    matterId: payload.matterId ?? null,
    contactId: payload.contactId ?? null,
    deletedAt: null,
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
      displayName: payload.displayName ?? payload.filename,
      mime: payload.mime,
      size: payload.size,
      storageKey: payload.storageKey,
      hash: objectHash,
      tags: payload.tags ?? [],
      version,
      matterId: payload.matterId ?? null,
      contactId: payload.contactId ?? null,
      folderId: targetFolderId,
      workflowStepId: payload.workflowStepId ?? null,
      parentDocumentId: payload.parentDocumentId ?? null,
      uploaderId: session!.user!.id,
      accessScope: payload.accessScope ?? "PUBLIC",
      ...(payload.accessMetadata ? { accessMetadata: payload.accessMetadata as Prisma.InputJsonValue } : {}),
    },
    include: {
      matter: { select: { id: true, title: true } },
      contact: {
        select: { id: true, firstName: true, lastName: true },
      },
      folder: {
        select: { id: true, name: true },
      },
      uploader: {
        select: { id: true, name: true, email: true } },
    },
  });

  console.log('[API] Created document:', {
    id: created.id,
    filename: created.filename,
    displayName: created.displayName,
    tags: created.tags,
    workflowStepId: created.workflowStepId,
  });

  await recordAuditLog({
    actorId: session!.user!.id,
    action: version === 1 ? "document.create" : "document.version",
    entityType: "document",
    entityId: created.id,
    metadata: {
      filename: payload.filename,
      version,
      matterId: payload.matterId,
      contactId: payload.contactId,
      folderId: targetFolderId,
      workflowStepId: payload.workflowStepId,
      tags: payload.tags,
      accessScope: payload.accessScope,
      uploadedBy: session!.user!.name ?? session!.user!.email,
    },
  });

  // If document is linked to a REQUEST_DOC workflow step, update step data
  if (created.workflowStepId && created.tags && created.tags.length > 0) {
    const workflowStep = await prisma.workflowInstanceStep.findUnique({
      where: { id: created.workflowStepId },
      include: {
        instance: {
          select: {
            matterId: true,
            contactId: true,
          },
        },
      },
    });

    if (workflowStep && workflowStep.actionType === "REQUEST_DOC") {
      const actionData = workflowStep.actionData as Prisma.JsonObject;
      
      // Config can be in actionData.config or at root level (from templateStep)
      const config = (actionData?.config as Prisma.JsonObject) || actionData || {};
      const documentNames = (config.documentNames as string[]) || [];
      
      // Runtime data is at root level of actionData
      let documentsStatus = (actionData?.documentsStatus as Array<{
        requestId: string;
        documentName: string;
        uploaded: boolean;
        documentId?: string;
        uploadedAt?: string;
        version?: number;
      }>) || [];

      // Ensure documentsStatus is initialized with all document names
      if (documentsStatus.length === 0) {
        documentsStatus = documentNames.map((name) => ({
          requestId: `${workflowStep.id}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          documentName: name,
          uploaded: false,
          version: 0,
        }));
      }

      // Find the document request by requestId (first tag if it looks like a requestId)
      // RequestId format: {stepId}-{normalized-name}
      const firstTag = created.tags[0];
      console.log('[API] Matching document upload:');
      console.log('  - Tags:', created.tags);
      console.log('  - First tag (requestId):', firstTag);
      console.log('  - Documents status:', documentsStatus);
      
      let docStatus = documentsStatus.find((d) => d.requestId === firstTag);
      console.log('  - Match by requestId:', docStatus ? 'FOUND' : 'NOT FOUND');
      
      // If not found by requestId, try matching by document name (backward compatibility)
      if (!docStatus) {
        docStatus = documentsStatus.find((d) => 
          created.tags.some(tag => tag.toLowerCase() === d.documentName.toLowerCase())
        );
        console.log('  - Match by documentName:', docStatus ? 'FOUND' : 'NOT FOUND');
      }

      if (docStatus) {
        console.log('[API] Found matching docStatus, updating...');
        console.log('  - Before update:', { ...docStatus });
        
        // Increment version and mark as uploaded
        docStatus.uploaded = true;
        docStatus.documentId = created.id;
        docStatus.uploadedAt = new Date().toISOString();
        docStatus.version = (docStatus.version || 0) + 1;
        
        console.log('  - After update:', { ...docStatus });

        // Check if all documents are uploaded
        const allUploaded = documentNames.every((name) => {
          const status = documentsStatus.find((d) => d.documentName === name);
          return status?.uploaded === true;
        });
        
        console.log('[API] All documents uploaded?', allUploaded);
        console.log('[API] Updated documentsStatus:', documentsStatus);

        // Update actionData with new status at root level
        const updatedActionData = {
          ...actionData,
          documentsStatus,
          allDocumentsUploaded: allUploaded,
          status: allUploaded ? "COMPLETED" : "IN_PROGRESS",
        };
        
        console.log('[API] Updating workflow step with actionState:', allUploaded ? 'COMPLETED' : 'unchanged');

        await prisma.workflowInstanceStep.update({
          where: { id: created.workflowStepId },
          data: {
            actionData: updatedActionData,
            // If all documents uploaded, mark step as COMPLETED
            ...(allUploaded ? { actionState: "COMPLETED", completedAt: new Date() } : {}),
          },
        });
        
        console.log('[API] Workflow step updated successfully');

        // Log workflow step document update
        if (workflowStep.instance.matterId) {
          await recordAuditLog({
            actorId: session!.user!.id,
            action: "workflow.step.document_uploaded",
            entityType: "matter",
            entityId: workflowStep.instance.matterId,
            metadata: {
              stepId: created.workflowStepId,
              stepTitle: workflowStep.title,
              requestId: docStatus.requestId,
              documentName: docStatus.documentName,
              version: docStatus.version,
              documentId: created.id,
              filename: created.filename,
              allDocumentsUploaded: allUploaded,
              remainingDocuments: documentNames.filter(name => {
                const status = documentsStatus.find(d => d.documentName === name);
                return !status?.uploaded;
              }),
            },
          });
        }
      }
    }
  }

  // Handle document versioning for matter-connected documents
  if (created.matterId) {
    // For workflow documents with requestId tag, version by requestId instead of filename
    const requestIdTag = created.tags && created.tags.length > 0 ? created.tags[0] : null;
    const isWorkflowDocument = requestIdTag && requestIdTag.includes('-') && created.workflowStepId;

    if (isWorkflowDocument) {
      // Group workflow documents by their requestId tag
      const existingDocs = await prisma.document.findMany({
        where: {
          matterId: created.matterId,
          workflowStepId: created.workflowStepId,
          tags: { has: requestIdTag },
          deletedAt: null,
          id: { not: created.id },
        },
        orderBy: {
          version: 'desc',
        },
        take: 1,
      });

      if (existingDocs.length > 0) {
        const latestDoc = existingDocs[0];
        await prisma.document.update({
          where: { id: created.id },
          data: {
            version: latestDoc.version + 1,
            parentDocumentId: latestDoc.parentDocumentId || latestDoc.id,
          },
        });
      }
    } else {
      // Traditional versioning: Check for existing documents with same filename in the same matter
      const existingDocs = await prisma.document.findMany({
        where: {
          matterId: created.matterId,
          filename: created.filename,
          folderId: created.folderId,
          deletedAt: null,
          id: { not: created.id }, // Exclude the just-created document
        },
        orderBy: {
          version: 'desc',
        },
        take: 1,
      });

      if (existingDocs.length > 0) {
        // Update the new document's version and parent reference
        const latestDoc = existingDocs[0];
        await prisma.document.update({
          where: { id: created.id },
          data: {
            version: latestDoc.version + 1,
            parentDocumentId: latestDoc.parentDocumentId || latestDoc.id,
          },
        });
      }
    }
  } else if (created.folderId) {
    // For non-matter documents, only version if same filename in same folder
    const existingDocs = await prisma.document.findMany({
      where: {
        folderId: created.folderId,
        filename: created.filename,
        deletedAt: null,
        matterId: null, // Only non-matter documents
        id: { not: created.id },
      },
      orderBy: {
        version: 'desc',
      },
      take: 1,
    });

    if (existingDocs.length > 0) {
      const latestDoc = existingDocs[0];
      await prisma.document.update({
        where: { id: created.id },
        data: {
          version: latestDoc.version + 1,
          parentDocumentId: latestDoc.parentDocumentId || latestDoc.id,
        },
      });
    }
  }

  return NextResponse.json({
    ...created,
    createdAt: created.createdAt.toISOString(),
    signedAt: created.signedAt?.toISOString() ?? null,
  }, { status: 201 });
});
