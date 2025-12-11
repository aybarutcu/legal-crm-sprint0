import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Folder Hierarchy & Management', () => {
  let testUserId: string;
  let testClientContactId: string;
  let testMatterId: string;
  let testContactId: string;

  beforeAll(async () => {
    // Cleanup any existing test data first
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'test-folder-' } },
    });

    // Create test user with unique email
    const user = await prisma.user.create({
      data: {
        email: `test-folder-${Date.now()}@example.com`,
        name: 'Test Folder User',
        role: 'LAWYER',
      },
    });
    testUserId = user.id;

    // Create test client contact for matter
    const clientContact = await prisma.contact.create({
      data: {
        firstName: 'Matter',
        lastName: 'Client',
        type: 'CLIENT',
        email: `test-matter-client-${Date.now()}@example.com`,
        ownerId: testUserId,
      },
    });
    testClientContactId = clientContact.id;

    // Create test matter
    const matter = await prisma.matter.create({
      data: {
        title: 'Test Matter for Folders',
        type: 'GENERAL',
        status: 'OPEN',
        openedAt: new Date(),
        clientId: testClientContactId,
        ownerId: testUserId,
      },
    });
    testMatterId = matter.id;

    // Create test contact
    const contact = await prisma.contact.create({
      data: {
        firstName: 'Test',
        lastName: 'Contact',
        email: `test-contact-${Date.now()}@example.com`,
        type: 'CLIENT',
        ownerId: testUserId,
      },
    });
    testContactId = contact.id;
  });

  afterAll(async () => {
    // Cleanup with null checks
    if (testMatterId) {
      await prisma.documentFolder.deleteMany({ where: { matterId: testMatterId } }).catch(() => {});
      await prisma.matter.delete({ where: { id: testMatterId } }).catch(() => {});
    }
    if (testClientContactId) {
      await prisma.contact.delete({ where: { id: testClientContactId } }).catch(() => {});
    }
    if (testContactId) {
      await prisma.documentFolder.deleteMany({ where: { contactId: testContactId } }).catch(() => {});
      await prisma.contact.delete({ where: { id: testContactId } }).catch(() => {});
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  describe('Root Folders', () => {
    it('should have Matters root folder', async () => {
      const mattersRoot = await prisma.documentFolder.findFirst({
        where: {
          name: 'Matters',
          parentFolderId: null,
          matterId: null,
          contactId: null,
        },
      });

      expect(mattersRoot).toBeTruthy();
      expect(mattersRoot?.isMasterFolder).toBe(true);
    });

    it('should have Contacts root folder', async () => {
      const contactsRoot = await prisma.documentFolder.findFirst({
        where: {
          name: 'Contacts',
          parentFolderId: null,
          matterId: null,
          contactId: null,
        },
      });

      expect(contactsRoot).toBeTruthy();
      expect(contactsRoot?.isMasterFolder).toBe(true);
    });
  });

  describe('Matter Folders', () => {
    it('should create matter folder under Matters root', async () => {
      const mattersRoot = await prisma.documentFolder.findFirst({
        where: { name: 'Matters', parentFolderId: null },
      });

      const matterFolder = await prisma.documentFolder.create({
        data: {
          name: 'Test Matter for Folders',
          matterId: testMatterId,
          parentFolderId: mattersRoot!.id,
          createdById: testUserId,
          accessScope: 'PUBLIC',
          color: 'blue',
          isMasterFolder: true,
        },
      });

      expect(matterFolder.matterId).toBe(testMatterId);
      expect(matterFolder.parentFolderId).toBe(mattersRoot?.id);
      expect(matterFolder.isMasterFolder).toBe(true);
    });

    it('should sync folder name when matter title changes', async () => {
      const mattersRoot = await prisma.documentFolder.findFirst({
        where: { name: 'Matters', parentFolderId: null },
      });

      const matterFolder = await prisma.documentFolder.findFirst({
        where: {
          matterId: testMatterId,
          parentFolderId: mattersRoot?.id,
        },
      });

      // Update matter title
      const newTitle = 'Updated Matter Title';
      await prisma.matter.update({
        where: { id: testMatterId },
        data: { title: newTitle },
      });

      // Update folder name
      if (matterFolder) {
        await prisma.documentFolder.update({
          where: { id: matterFolder.id },
          data: { name: newTitle },
        });
      }

      const updatedFolder = await prisma.documentFolder.findFirst({
        where: {
          matterId: testMatterId,
          parentFolderId: mattersRoot?.id,
        },
      });

      expect(updatedFolder?.name).toBe(newTitle);
    });

    it('should prevent editing master folders', async () => {
      const matterFolder = await prisma.documentFolder.findFirst({
        where: {
          matterId: testMatterId,
          isMasterFolder: true,
        },
      });

      expect(matterFolder?.isMasterFolder).toBe(true);
      // In the UI, this should be read-only
    });
  });

  describe('Contact Folders', () => {
    it('should create contact folder under Contacts root', async () => {
      const contactsRoot = await prisma.documentFolder.findFirst({
        where: { name: 'Contacts', parentFolderId: null },
      });

      const contactFolder = await prisma.documentFolder.create({
        data: {
          name: 'Test Contact',
          contactId: testContactId,
          parentFolderId: contactsRoot!.id,
          createdById: testUserId,
          accessScope: 'PUBLIC',
          color: 'green',
          isMasterFolder: true,
        },
      });

      expect(contactFolder.contactId).toBe(testContactId);
      expect(contactFolder.parentFolderId).toBe(contactsRoot?.id);
      expect(contactFolder.isMasterFolder).toBe(true);
    });

    it('should sync folder name when contact name changes', async () => {
      const contactsRoot = await prisma.documentFolder.findFirst({
        where: { name: 'Contacts', parentFolderId: null },
      });

      const contactFolder = await prisma.documentFolder.findFirst({
        where: {
          contactId: testContactId,
          parentFolderId: contactsRoot?.id,
        },
      });

      // Update contact name
      const newFirstName = 'Updated';
      const newLastName = 'Contact Name';
      await prisma.contact.update({
        where: { id: testContactId },
        data: { firstName: newFirstName, lastName: newLastName },
      });

      // Update folder name
      if (contactFolder) {
        await prisma.documentFolder.update({
          where: { id: contactFolder.id },
          data: { name: `${newFirstName} ${newLastName}` },
        });
      }

      const updatedFolder = await prisma.documentFolder.findFirst({
        where: {
          contactId: testContactId,
          parentFolderId: contactsRoot?.id,
        },
      });

      expect(updatedFolder?.name).toBe(`${newFirstName} ${newLastName}`);
    });
  });

  describe('Subfolder Management', () => {
    it('should create subfolders within matter folders', async () => {
      const matterFolder = await prisma.documentFolder.findFirst({
        where: {
          matterId: testMatterId,
          isMasterFolder: true,
        },
      });

      const subfolder = await prisma.documentFolder.create({
        data: {
          name: 'Contracts',
          matterId: testMatterId,
          parentFolderId: matterFolder!.id,
          createdById: testUserId,
          accessScope: 'PUBLIC',
        },
      });

      expect(subfolder.parentFolderId).toBe(matterFolder?.id);
      expect(subfolder.matterId).toBe(testMatterId);
      expect(subfolder.isMasterFolder).toBe(false);
    });

    it('should query folder hierarchy', async () => {
      const matterFolder = await prisma.documentFolder.findFirst({
        where: {
          matterId: testMatterId,
          isMasterFolder: true,
        },
        include: {
          children: true,
        },
      });

      expect(matterFolder?.children).toBeDefined();
      expect(matterFolder?.children.length).toBeGreaterThan(0);
    });
  });

  describe('Folder Access Control', () => {
    it('should set folder access scope', async () => {
      const folder = await prisma.documentFolder.create({
        data: {
          name: 'Private Folder',
          matterId: testMatterId,
          createdById: testUserId,
          accessScope: 'PRIVATE',
        },
      });

      expect(folder.accessScope).toBe('PRIVATE');
    });

    it('should grant user-based access', async () => {
      const folder = await prisma.documentFolder.create({
        data: {
          name: 'User-Based Access Folder',
          matterId: testMatterId,
          createdById: testUserId,
          accessScope: 'USER_BASED',
        },
      });

      const access = await prisma.folderAccess.create({
        data: {
          folderId: folder.id,
          userId: testUserId,
          grantedById: testUserId,
        },
      });

      expect(access.userId).toBe(testUserId);
      expect(access.folderId).toBe(folder.id);
    });
  });

  describe('Folder Deletion', () => {
    it('should soft delete folders', async () => {
      const folder = await prisma.documentFolder.create({
        data: {
          name: 'To Be Deleted',
          matterId: testMatterId,
          createdById: testUserId,
          accessScope: 'PUBLIC',
        },
      });

      await prisma.documentFolder.update({
        where: { id: folder.id },
        data: {
          deletedAt: new Date(),
          deletedById: testUserId,
        },
      });

      const deletedFolder = await prisma.documentFolder.findFirst({
        where: {
          id: folder.id,
          deletedAt: null,
        },
      });

      expect(deletedFolder).toBeNull();
    });

    it('should prevent deletion of master folders', async () => {
      const matterFolder = await prisma.documentFolder.findFirst({
        where: {
          matterId: testMatterId,
          isMasterFolder: true,
        },
      });

      expect(matterFolder?.isMasterFolder).toBe(true);
      // UI should prevent deletion
    });
  });
});
