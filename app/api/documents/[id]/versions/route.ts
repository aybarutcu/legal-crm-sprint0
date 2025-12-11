import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";

export const GET = withApiHandler<{ id: string }>(
  async (req, { params, session }) => {
    const { id } = await params;

    // Fetch the current document
    const currentDoc = await prisma.document.findUnique({
      where: { id },
      select: { 
        parentDocumentId: true,
        version: true,
      },
    });

    if (!currentDoc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Find the root document by traversing up the parent chain
    let rootId = id;
    let currentParentId = currentDoc.parentDocumentId;
    
    while (currentParentId) {
      rootId = currentParentId;
      const parent = await prisma.document.findUnique({
        where: { id: currentParentId },
        select: { parentDocumentId: true },
      });
      
      if (!parent) break;
      currentParentId = parent.parentDocumentId;
    }

    // Fetch all versions in this version chain recursively
    // Start with the root document
    const allVersions = await prisma.document.findMany({
      where: {
        OR: [
          { id: rootId }, // The root document (v1)
          { parentDocumentId: rootId }, // Direct children of root (v2)
        ],
        deletedAt: null,
      },
      select: {
        id: true,
        filename: true,
        displayName: true,
        mime: true,
        size: true,
        version: true,
        tags: true,
        storageKey: true,
        hash: true,
        createdAt: true,
        parentDocumentId: true,
        uploader: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Now find all descendants recursively (v3, v4, etc.)
    const getAllDescendants = async (parentIds: string[]): Promise<any[]> => {
      if (parentIds.length === 0) return [];
      
      const children = await prisma.document.findMany({
        where: {
          parentDocumentId: { in: parentIds },
          deletedAt: null,
        },
        select: {
          id: true,
          filename: true,
          displayName: true,
          mime: true,
          size: true,
          version: true,
          tags: true,
          storageKey: true,
          hash: true,
          createdAt: true,
          parentDocumentId: true,
          uploader: {
            select: { id: true, name: true, email: true },
          },
        },
      });
      
      if (children.length === 0) return [];
      
      const childIds = children.map(c => c.id);
      const grandchildren = await getAllDescendants(childIds);
      
      return [...children, ...grandchildren];
    };

    // Get IDs of all current versions
    const currentVersionIds = allVersions.map(v => v.id);
    
    // Get all descendants
    const descendants = await getAllDescendants(currentVersionIds);
    
    // Combine and deduplicate
    const allVersionsComplete = [...allVersions, ...descendants];
    const uniqueVersions = Array.from(
      new Map(allVersionsComplete.map(v => [v.id, v])).values()
    );

    // Sort by version number
    uniqueVersions.sort((a, b) => a.version - b.version);

    return NextResponse.json({
      versions: uniqueVersions.map((doc) => ({
        id: doc.id,
        filename: doc.filename,
        displayName: doc.displayName,
        mime: doc.mime,
        size: doc.size,
        version: doc.version,
        tags: doc.tags,
        storageKey: doc.storageKey,
        hash: doc.hash,
        createdAt: doc.createdAt.toISOString(),
        uploader: doc.uploader,
      })),
    });
  },
  { requireAuth: true }
);
