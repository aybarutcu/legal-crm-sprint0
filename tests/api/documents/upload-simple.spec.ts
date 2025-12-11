import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Simplified Document Upload & Versioning Tests
 * 
 * These tests verify document creation and versioning behavior
 * using direct Prisma operations that mirror the API logic.
 */
describe('Document Upload & Versioning (Simplified)', () => {
  let testMatterId: string;
  let testUserId: string;
  let testClientId: string;
  let testFolderId: string | null = null;

  beforeAll(async () => {
    // Cleanup any existing test data
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'test-upload-simple-' } },
    });

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `test-upload-simple-${Date.now()}@example.com`,
        name: 'Test Upload User',
        role: 'LAWYER',
      },
    });
    testUserId = user.id;

    // Create test client
    const client = await prisma.contact.create({
      data: {
        firstName: 'Test',
        lastName: 'Client',
        type: 'CLIENT',
        email: `test-client-simple-${Date.now()}@example.com`,
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

    // Check if folder was auto-created (system behavior)
    const folder = await prisma.documentFolder.findFirst({
      where: { matterId: testMatterId },
    });
    testFolderId = folder?.id || null;
  });

  afterAll(async () => {
    // Cleanup in reverse order of creation
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
    if (!testFolderId) {
      console.log('⚠️  No folder auto-created, creating one manually');
      const folder = await prisma.documentFolder.create({
        data: {
          name: 'Test Folder',
          matter: { connect: { id: testMatterId } },
          createdBy: { connect: { id: testUserId } },
          accessScope: 'PUBLIC',
        },
      });
      testFolderId = folder.id;
    }

    const doc = await prisma.document.create({
      data: {
        filename: 'test-doc.pdf',
        displayName: 'Test Document',
        mime: 'application/pdf',
        size: 1024,
        storageKey: 'documents/test/v1/test-doc.pdf',
        version: 1,
        uploader: { connect: { id: testUserId } },
        matter: { connect: { id: testMatterId } },
        folder: { connect: { id: testFolderId } },
      },
    });

    expect(doc.version).toBe(1);
    expect(doc.displayName).toBe('Test Document');
    expect(doc.parentDocumentId).toBeNull();
  });

  it('should create a new version with parentDocumentId', async () => {
    if (!testFolderId) {
      throw new Error('Test folder not available');
    }

    // Create parent document (v1)
    const parentDoc = await prisma.document.create({
      data: {
        filename: 'versioned-doc.pdf',
        displayName: 'Versioned Document',
        mime: 'application/pdf',
        size: 2048,
        storageKey: 'documents/parent/v1/versioned-doc.pdf',
        version: 1,
        uploader: { connect: { id: testUserId } },
        matter: { connect: { id: testMatterId } },
        folder: { connect: { id: testFolderId } },
      },
    });

    // Create new version (v2) linked to parent
    const newVersion = await prisma.document.create({
      data: {
        filename: 'versioned-doc.pdf',
        displayName: 'Versioned Document',
        mime: 'application/pdf',
        size: 3072,
        storageKey: 'documents/parent/v2/versioned-doc.pdf',
        version: 2,
        parentDocument: { connect: { id: parentDoc.id } },
        uploader: { connect: { id: testUserId } },
        matter: { connect: { id: testMatterId } },
        folder: { connect: { id: testFolderId } },
      },
    });

    expect(newVersion.version).toBe(2);
    expect(newVersion.parentDocumentId).toBe(parentDoc.id);
    expect(newVersion.filename).toBe(parentDoc.filename);
  });

  it('should query all versions of a document', async () => {
    if (!testFolderId) {
      throw new Error('Test folder not available');
    }

    const filename = 'multi-version.pdf';
    const displayName = 'Multi-Version Document';

    // Create v1 (root)
    const v1 = await prisma.document.create({
      data: {
        filename,
        displayName,
        mime: 'application/pdf',
        size: 1024,
        storageKey: `documents/multi/v1/${filename}`,
        version: 1,
        uploader: { connect: { id: testUserId } },
        matter: { connect: { id: testMatterId } },
        folder: { connect: { id: testFolderId } },
      },
    });

    // Create v2
    await prisma.document.create({
      data: {
        filename,
        displayName,
        mime: 'application/pdf',
        size: 2048,
        storageKey: `documents/multi/v2/${filename}`,
        version: 2,
        parentDocument: { connect: { id: v1.id } },
        uploader: { connect: { id: testUserId } },
        matter: { connect: { id: testMatterId } },
        folder: { connect: { id: testFolderId } },
      },
    });

    // Create v3
    await prisma.document.create({
      data: {
        filename,
        displayName,
        mime: 'application/pdf',
        size: 3072,
        storageKey: `documents/multi/v3/${filename}`,
        version: 3,
        parentDocument: { connect: { id: v1.id } },
        uploader: { connect: { id: testUserId } },
        matter: { connect: { id: testMatterId } },
        folder: { connect: { id: testFolderId } },
      },
    });

    // Query all versions (root + children)
    const allVersions = await prisma.document.findMany({
      where: {
        OR: [
          { id: v1.id },
          { parentDocumentId: v1.id },
        ],
        deletedAt: null,
      },
      orderBy: { version: 'asc' },
    });

    expect(allVersions).toHaveLength(3);
    expect(allVersions[0].version).toBe(1);
    expect(allVersions[1].version).toBe(2);
    expect(allVersions[2].version).toBe(3);
  });

  it('should get the latest version', async () => {
    if (!testFolderId) {
      throw new Error('Test folder not available');
    }

    const filename = 'latest-test.pdf';

    // Create v1
    const v1 = await prisma.document.create({
      data: {
        filename,
        displayName: 'Latest Test',
        mime: 'application/pdf',
        size: 1024,
        storageKey: `documents/latest/v1/${filename}`,
        version: 1,
        uploader: { connect: { id: testUserId } },
        matter: { connect: { id: testMatterId } },
        folder: { connect: { id: testFolderId } },
      },
    });

    // Create v2
    await prisma.document.create({
      data: {
        filename,
        displayName: 'Latest Test',
        mime: 'application/pdf',
        size: 2048,
        storageKey: `documents/latest/v2/${filename}`,
        version: 2,
        parentDocument: { connect: { id: v1.id } },
        uploader: { connect: { id: testUserId } },
        matter: { connect: { id: testMatterId } },
        folder: { connect: { id: testFolderId } },
      },
    });

    // Query latest version
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

  it('should soft delete documents without affecting versions', async () => {
    if (!testFolderId) {
      throw new Error('Test folder not available');
    }

    const filename = 'soft-delete.pdf';

    // Create v1
    const v1 = await prisma.document.create({
      data: {
        filename,
        displayName: 'Soft Delete Test',
        mime: 'application/pdf',
        size: 1024,
        storageKey: `documents/soft/v1/${filename}`,
        version: 1,
        uploader: { connect: { id: testUserId } },
        matter: { connect: { id: testMatterId } },
        folder: { connect: { id: testFolderId } },
      },
    });

    // Create v2
    const v2 = await prisma.document.create({
      data: {
        filename,
        displayName: 'Soft Delete Test',
        mime: 'application/pdf',
        size: 2048,
        storageKey: `documents/soft/v2/${filename}`,
        version: 2,
        parentDocument: { connect: { id: v1.id } },
        uploader: { connect: { id: testUserId } },
        matter: { connect: { id: testMatterId } },
        folder: { connect: { id: testFolderId } },
      },
    });

    // Soft delete v1
    await prisma.document.update({
      where: { id: v1.id },
      data: {
        deletedAt: new Date(),
        deletedBy: testUserId,
      },
    });

    // v2 should still be queryable
    const activeVersions = await prisma.document.findMany({
      where: {
        OR: [
          { id: v1.id },
          { parentDocumentId: v1.id },
        ],
        deletedAt: null,
      },
    });

    expect(activeVersions).toHaveLength(1);
    expect(activeVersions[0].id).toBe(v2.id);
  });
});
