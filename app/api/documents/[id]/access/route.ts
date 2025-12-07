/**
 * Document Access Management API
 * 
 * GET    - List all access grants for a document
 * POST   - Grant access to user(s) or update access scope
 * DELETE - Revoke access from specific user(s)
 */

import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";
import {
  checkDocumentAccess,
  getDocumentAccessGrants,
  grantDocumentAccess,
  revokeDocumentAccess,
  updateDocumentAccessScope,
} from "@/lib/documents/access-control";
import { DocumentAccessScope } from "@prisma/client";

/**
 * GET /api/documents/[id]/access
 * List all users with access to this document
 */
export const GET = withApiHandler<{ id: string }>(
  async (req, { params, session }) => {
    const { id } = await params;

    // Check if user can manage access (must be uploader, owner, or admin)
    const access = await checkDocumentAccess(
      { id } as any,
      { userId: session.user.id, userRole: session.user.role }
    );

    if (!access.hasAccess) {
      return NextResponse.json(
        { error: "Access denied", reason: access.reason },
        { status: 403 }
      );
    }

    // Get document details
    const document = await prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        filename: true,
        accessScope: true,
        accessMetadata: true,
        uploaderId: true,
        matterId: true,
        contactId: true,
        matter: {
          select: {
            id: true,
            ownerId: true,
          },
        },
        contact: {
          select: {
            id: true,
            ownerId: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Get explicit access grants
    const grants = await getDocumentAccessGrants(id);

    return NextResponse.json({
      document: {
        id: document.id,
        filename: document.filename,
        accessScope: document.accessScope,
        accessMetadata: document.accessMetadata,
      },
      grants: grants.map((grant) => ({
        id: grant.id,
        userId: grant.userId,
        user: {
          id: grant.user.id,
          name: grant.user.name,
          email: grant.user.email,
          role: grant.user.role,
        },
        grantedBy: {
          id: grant.grantor.id,
          name: grant.grantor.name,
          email: grant.grantor.email,
        },
        grantedAt: grant.grantedAt.toISOString(),
      })),
    });
  },
  { requireAuth: true }
);

/**
 * POST /api/documents/[id]/access
 * Update document access scope and/or grant access to users
 */
export const POST = withApiHandler<{ id: string }>(
  async (req, { params, session }) => {
    const { id } = await params;
    const body = await req.json();

    const {
      accessScope,
      accessMetadata,
      grantUserIds,
    }: {
      accessScope?: DocumentAccessScope;
      accessMetadata?: Record<string, unknown>;
      grantUserIds?: string[];
    } = body;

    // Get document
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        matter: true,
        contact: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Check if user can manage access
    const isUploader = document.uploaderId === session.user.id;
    const isAdmin = session.user.role === "ADMIN";
    const isMatterOwner = document.matter?.ownerId === session.user.id;
    const isContactOwner = document.contact?.ownerId === session.user.id;

    if (!isUploader && !isAdmin && !isMatterOwner && !isContactOwner) {
      return NextResponse.json(
        { error: "Only the uploader, owner, or admin can manage document access" },
        { status: 403 }
      );
    }

    // Update access scope if provided
    if (accessScope) {
      await updateDocumentAccessScope(id, accessScope, accessMetadata);

      await recordAuditLog({
        actorId: session.user.id,
        action: "document.access.update",
        entityType: "Document",
        entityId: id,
        metadata: {
          filename: document.filename,
          oldScope: document.accessScope,
          newScope: accessScope,
          accessMetadata,
        },
      });
    }

    // Grant access to users if provided (for USER_BASED scope)
    if (grantUserIds && grantUserIds.length > 0) {
      for (const userId of grantUserIds) {
        await grantDocumentAccess(id, userId, session.user.id);
      }

      await recordAuditLog({
        actorId: session.user.id,
        action: "document.access.grant",
        entityType: "Document",
        entityId: id,
        metadata: {
          filename: document.filename,
          grantedToUserIds: grantUserIds,
          grantedCount: grantUserIds.length,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Access control updated successfully",
    });
  },
  { requireAuth: true }
);

/**
 * DELETE /api/documents/[id]/access?userId=xxx
 * Revoke access from a specific user
 */
export const DELETE = withApiHandler<{ id: string }>(
  async (req, { params, session }) => {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId query parameter is required" },
        { status: 400 }
      );
    }

    // Get document
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        matter: true,
        contact: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Check if user can manage access
    const isUploader = document.uploaderId === session.user.id;
    const isAdmin = session.user.role === "ADMIN";
    const isMatterOwner = document.matter?.ownerId === session.user.id;
    const isContactOwner = document.contact?.ownerId === session.user.id;

    if (!isUploader && !isAdmin && !isMatterOwner && !isContactOwner) {
      return NextResponse.json(
        { error: "Only the uploader, owner, or admin can manage document access" },
        { status: 403 }
      );
    }

    // Revoke access
    await revokeDocumentAccess(id, userId);

    await recordAuditLog({
      actorId: session.user.id,
      action: "document.access.revoke",
      entityType: "Document",
      entityId: id,
      metadata: {
        filename: document.filename,
        revokedFromUserId: userId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Access revoked successfully",
    });
  },
  { requireAuth: true }
);
