import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Document Upload & Versioning (API Integration)', () => {
  let testMatterId: string;
  let testUserId: string;
  let testClientId: string;
  let testFolderId: string;

  beforeAll(async () => {
    // Cleanup any existing test data first
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'test-upload-' } },
    });

    // Create test user with unique email
    const user = await prisma.user.create({
      data: {
        email: `test-upload-${Date.now()}@example.com`,
        name: 'Test Upload User',
        role: 'LAWYER',
      },
    });
    testUserId = user.id;

    // Create test client contact
    const client = await prisma.contact.create({
      data: {
        firstName: 'Test',
        lastName: 'Client',
        type: 'CLIENT',
        email: `test-client-${Date.now()}@example.com`,
        ownerId: testUserId,
      },
    });
    testClientId = client.id;

    // Create test matter
    const matter = await prisma.matter.create({
      data: {
        title: 'Test Matter for Upload',
        type: 'GENERAL',
        status: 'OPEN',
        openedAt: new Date(),
        clientId: testClientId,
        ownerId: testUserId,
      },
    });
    testMatterId = matter.id;

    // Folders are auto-created by the system, query for the matter's folder
    const folder = await prisma.documentFolder.findFirst({
      where: { matterId: testMatterId },
    });
    if (folder) {
      testFolderId = folder.id;
    }
  });

  afterAll(async () => {
    // Cleanup - check if IDs exist before deleting
    if (testMatterId) {
      await prisma.document.deleteMany({ where: { matterId: testMatterId } }).catch(() => {});
      await prisma.documentFolder.deleteMany({ where: { matterId: testMatterId } }).catch(() => {});
      await prisma.matter.delete({ where: { id: testMatterId } }).catch(() => {});
    }
    if (testClientId) {
      await prisma.contact.delete({ where: { id: testClientId } }).catch(() => {});
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('should create a document with version 1', async () => {
    const doc = await prisma.document.create({
      data: {
        filename: 'test-doc.pdf',
        displayName: 'Test Document',
        mime: 'application/pdf',
        size: 1024,
        storageKey: 'documents/test/v1/test-doc.pdf',
        version: 1,
        uploadedById: testUserId,
        matterId: testMatterId,
        folderId: testFolderId,
      },
    });

    expect(doc.version).toBe(1);
    expect(doc.displayName).toBe('Test Document');
    expect(doc.parentDocumentId).toBeNull();
  });

  it('should create a new version with parentDocumentId', async () => {
    // Create parent document
    const parentDoc = await prisma.document.create({
      data: {
        filename: 'versioned-doc.pdf',
        displayName: 'Versioned Document',
        mime: 'application/pdf',
        size: 2048,
        storageKey: 'documents/parent/v1/versioned-doc.pdf',
        version: 1,
        uploadedById: testUserId,
        matterId: testMatterId,
        folderId: testFolderId,
      },
    });

    // Create version 2
    const versionDoc = await prisma.document.create({
      data: {
        filename: 'versioned-doc-v2.pdf',
        displayName: 'Versioned Document',
        mime: 'application/pdf',
        size: 3072,
        storageKey: 'documents/parent/v2/versioned-doc-v2.pdf',
        version: 2,
        parentDocumentId: parentDoc.id,
        uploadedById: testUserId,
        matterId: testMatterId,
        folderId: testFolderId,
      },
    });

    expect(versionDoc.version).toBe(2);
    expect(versionDoc.parentDocumentId).toBe(parentDoc.id);
    expect(versionDoc.displayName).toBe(parentDoc.displayName);
  });

  it('should query all versions of a document', async () => {
    const displayName = 'Multi-Version Document';

    // Create parent
    const v1 = await prisma.document.create({
      data: {
        filename: 'multi-v1.pdf',
        displayName,
        mime: 'application/pdf',
        size: 1024,
        storageKey: 'documents/multi/v1/multi-v1.pdf',
        version: 1,
        uploadedById: testUserId,
        matterId: testMatterId,
        folderId: testFolderId,
      },
    });

    // Create v2
    const v2 = await prisma.document.create({
      data: {
        filename: 'multi-v2.pdf',
        displayName,
        mime: 'application/pdf',
        size: 2048,
        storageKey: 'documents/multi/v2/multi-v2.pdf',
        version: 2,
        parentDocumentId: v1.id,
        uploadedById: testUserId,
        matterId: testMatterId,
        folderId: testFolderId,
      },
    });

    // Create v3
    const v3 = await prisma.document.create({
      data: {
        filename: 'multi-v3.pdf',
        displayName,
        mime: 'application/pdf',
        size: 3072,
        storageKey: 'documents/multi/v3/multi-v3.pdf',
        version: 3,
        parentDocumentId: v1.id,
        uploadedById: testUserId,
        matterId: testMatterId,
        folderId: testFolderId,
      },
    });

    // Query all versions
    const versions = await prisma.document.findMany({
      where: {
        OR: [
          { id: v1.id },
          { parentDocumentId: v1.id },
        ],
        deletedAt: null,
      },
      orderBy: { version: 'asc' },
    });

    expect(versions).toHaveLength(3);
    expect(versions[0].version).toBe(1);
    expect(versions[1].version).toBe(2);
    expect(versions[2].version).toBe(3);
  });

  it('should get the latest version', async () => {
    const displayName = 'Latest Version Test';

    const v1 = await prisma.document.create({
      data: {
        filename: 'latest-v1.pdf',
        displayName,
        mime: 'application/pdf',
        size: 1024,
        storageKey: 'documents/latest/v1/latest-v1.pdf',
        version: 1,
        uploadedById: testUserId,
        matterId: testMatterId,
        folderId: testFolderId,
      },
    });

    await prisma.document.create({
      data: {
        filename: 'latest-v2.pdf',
        displayName,
        mime: 'application/pdf',
        size: 2048,
        storageKey: 'documents/latest/v2/latest-v2.pdf',
        version: 2,
        parentDocumentId: v1.id,
        uploadedById: testUserId,
        matterId: testMatterId,
        folderId: testFolderId,
      },
    });

    // Get latest version
    const latest = await prisma.document.findFirst({
      where: {
        OR: [
          { id: v1.id },
          { parentDocumentId: v1.id },
        ],
        deletedAt: null,
      },
      orderBy: { version: 'desc' },
    });

    expect(latest?.version).toBe(2);
  });

  it('should calculate next version correctly', async () => {
    const displayName = 'Next Version Test';
    const folderId = testFolderId;

    // Create v1
    await prisma.document.create({
      data: {
        filename: 'next-v1.pdf',
        displayName,
        mime: 'application/pdf',
        size: 1024,
        storageKey: 'documents/next/v1/next-v1.pdf',
        version: 1,
        uploadedById: testUserId,
        matterId: testMatterId,
        folderId,
      },
    });

    // Query max version
    const aggregate = await prisma.document.aggregate({
      _max: { version: true },
      where: {
        displayName,
        folderId,
        matterId: testMatterId,
        deletedAt: null,
      },
    });

    const nextVersion = (aggregate._max.version ?? 0) + 1;
    expect(nextVersion).toBe(2);
  });

  it('should soft delete documents without affecting versions', async () => {
    const displayName = 'Soft Delete Test';

    const v1 = await prisma.document.create({
      data: {
        filename: 'soft-delete-v1.pdf',
        displayName,
        mime: 'application/pdf',
        size: 1024,
        storageKey: 'documents/soft/v1/soft-delete-v1.pdf',
        version: 1,
        uploadedById: testUserId,
        matterId: testMatterId,
        folderId: testFolderId,
      },
    });

    // Soft delete
    await prisma.document.update({
      where: { id: v1.id },
      data: {
        deletedAt: new Date(),
        deletedById: testUserId,
      },
    });

    // Should not appear in active documents
    const activeDoc = await prisma.document.findFirst({
      where: {
        id: v1.id,
        deletedAt: null,
      },
    });

    expect(activeDoc).toBeNull();

    // But should still exist
    const deletedDoc = await prisma.document.findUnique({
      where: { id: v1.id },
    });

    expect(deletedDoc?.deletedAt).not.toBeNull();
  });
});
