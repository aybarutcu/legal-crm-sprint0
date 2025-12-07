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

    // Determine the root document ID
    // If this document is a version (has parentDocumentId), use that as the root
    // Otherwise, this document is the root
    const rootId = currentDoc.parentDocumentId || id;

    // Fetch all versions in this version chain
    // This includes:
    // 1. The root document itself
    // 2. All documents that have this root as their parent
    const allVersions = await prisma.document.findMany({
      where: {
        OR: [
          { id: rootId }, // The root document
          { parentDocumentId: rootId }, // All versions of the root
        ],
        deletedAt: null,
      },
      orderBy: { version: "asc" },
      include: {
        uploader: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({
      versions: allVersions.map((doc) => ({
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
