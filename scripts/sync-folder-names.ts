#!/usr/bin/env tsx
/**
 * Migration Script: Sync Matter and Contact Folder Names
 * 
 * This script synchronizes folder names with their associated matter titles
 * and contact names. It fixes any drift that occurred before the auto-sync
 * feature was implemented.
 * 
 * Usage:
 *   npx tsx scripts/sync-folder-names.ts [--dry-run]
 * 
 * Options:
 *   --dry-run    Show what would be changed without making actual changes
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SyncResult {
  totalMatters: number;
  totalContacts: number;
  matterFoldersSynced: number;
  contactFoldersSynced: number;
  matterFoldersCreated: number;
  contactFoldersCreated: number;
  errors: Array<{ type: string; id: string; error: string }>;
}

const isDryRun = process.argv.includes('--dry-run');

// Fetch system user (first admin) to use as creator of root folders
let systemUserId: string | null = null;

async function getSystemUser(): Promise<string> {
  if (systemUserId) return systemUserId;
  
  const adminUser = await prisma.user.findFirst({
    where: { role: "ADMIN", deletedAt: null },
    select: { id: true },
  });

  if (!adminUser) {
    throw new Error('No admin user found in database. Cannot create root folders.');
  }

  systemUserId = adminUser.id;
  return systemUserId;
}

async function syncMatterFolders(result: SyncResult): Promise<void> {
  console.log('\n📂 Syncing Matter Folders...\n');

  // Get "Matters" root folder or create it
  let mattersRoot = await prisma.documentFolder.findFirst({
    where: {
      name: "Matters",
      parentFolderId: null,
      matterId: null,
      contactId: null,
      deletedAt: null,
    },
  });

  if (!mattersRoot && !isDryRun) {
    console.log('  ✨ Creating "Matters" root folder...');
    const creatorId = await getSystemUser();
    mattersRoot = await prisma.documentFolder.create({
      data: {
        name: "Matters",
        createdById: creatorId,
        accessScope: "PUBLIC",
      },
    });
  }

  // Get all non-deleted matters
  const matters = await prisma.matter.findMany({
    where: { deletedAt: null },
    select: { id: true, title: true },
  });

  result.totalMatters = matters.length;
  console.log(`  Found ${matters.length} matters to process\n`);

  for (const matter of matters) {
    try {
      // Find matter's root folder
      const matterFolder = await prisma.documentFolder.findFirst({
        where: {
          matterId: matter.id,
          parentFolderId: mattersRoot?.id ?? { not: null },
          deletedAt: null,
        },
      });

      if (matterFolder) {
        // Check if name needs updating
        if (matterFolder.name !== matter.title) {
          console.log(`  📝 Matter: "${matter.title}" (ID: ${matter.id})`);
          console.log(`     Folder name: "${matterFolder.name}" → "${matter.title}"`);
          
          if (!isDryRun) {
            await prisma.documentFolder.update({
              where: { id: matterFolder.id },
              data: { name: matter.title },
            });
            console.log(`     ✅ Updated`);
          } else {
            console.log(`     🔍 Would update (dry run)`);
          }
          
          result.matterFoldersSynced++;
        }
      } else if (mattersRoot) {
        // Folder doesn't exist, create it
        console.log(`  ➕ Matter: "${matter.title}" (ID: ${matter.id})`);
        console.log(`     Creating new folder under /Matters/`);
        
        if (!isDryRun) {
          const creatorId = await getSystemUser();
          await prisma.documentFolder.create({
            data: {
              name: matter.title,
              matterId: matter.id,
              parentFolderId: mattersRoot.id,
              createdById: creatorId,
              accessScope: "PUBLIC",
              color: "blue",
            },
          });
          console.log(`     ✅ Created`);
        } else {
          console.log(`     🔍 Would create (dry run)`);
        }
        
        result.matterFoldersCreated++;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`  ❌ Error processing matter ${matter.id}: ${errorMsg}`);
      result.errors.push({
        type: 'matter',
        id: matter.id,
        error: errorMsg,
      });
    }
  }
}

async function syncContactFolders(result: SyncResult): Promise<void> {
  console.log('\n👤 Syncing Contact Folders...\n');

  // Get "Contacts" root folder or create it
  let contactsRoot = await prisma.documentFolder.findFirst({
    where: {
      name: "Contacts",
      parentFolderId: null,
      matterId: null,
      contactId: null,
      deletedAt: null,
    },
  });

  if (!contactsRoot && !isDryRun) {
    console.log('  ✨ Creating "Contacts" root folder...');
    const creatorId = await getSystemUser();
    contactsRoot = await prisma.documentFolder.create({
      data: {
        name: "Contacts",
        createdById: creatorId,
        accessScope: "PUBLIC",
      },
    });
  }

  // Get all non-deleted contacts
  const contacts = await prisma.contact.findMany({
    where: { deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  });

  result.totalContacts = contacts.length;
  console.log(`  Found ${contacts.length} contacts to process\n`);

  for (const contact of contacts) {
    try {
      const expectedName = `${contact.firstName} ${contact.lastName}`.trim();
      
      // Find contact's root folder
      const contactFolder = await prisma.documentFolder.findFirst({
        where: {
          contactId: contact.id,
          parentFolderId: contactsRoot?.id ?? { not: null },
          deletedAt: null,
        },
      });

      if (contactFolder) {
        // Check if name needs updating
        if (contactFolder.name !== expectedName) {
          console.log(`  📝 Contact: "${expectedName}" (ID: ${contact.id})`);
          console.log(`     Folder name: "${contactFolder.name}" → "${expectedName}"`);
          
          if (!isDryRun) {
            await prisma.documentFolder.update({
              where: { id: contactFolder.id },
              data: { name: expectedName },
            });
            console.log(`     ✅ Updated`);
          } else {
            console.log(`     🔍 Would update (dry run)`);
          }
          
          result.contactFoldersSynced++;
        }
      } else if (contactsRoot) {
        // Check if contact has any documents - only create folder if needed
        const documentCount = await prisma.document.count({
          where: {
            contactId: contact.id,
            deletedAt: null,
          },
        });

        if (documentCount > 0) {
          console.log(`  ➕ Contact: "${expectedName}" (ID: ${contact.id})`);
          console.log(`     Creating new folder under /Contacts/ (${documentCount} documents)`);
          
          if (!isDryRun) {
            const creatorId = await getSystemUser();
            await prisma.documentFolder.create({
              data: {
                name: expectedName,
                contactId: contact.id,
                parentFolderId: contactsRoot.id,
                createdById: creatorId,
                accessScope: "PUBLIC",
                color: "green",
              },
            });
            console.log(`     ✅ Created`);
          } else {
            console.log(`     🔍 Would create (dry run)`);
          }
          
          result.contactFoldersCreated++;
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`  ❌ Error processing contact ${contact.id}: ${errorMsg}`);
      result.errors.push({
        type: 'contact',
        id: contact.id,
        error: errorMsg,
      });
    }
  }
}

async function main() {
  console.log('🔄 Matter and Contact Folder Sync Migration\n');
  console.log('='.repeat(60));
  
  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  const result: SyncResult = {
    totalMatters: 0,
    totalContacts: 0,
    matterFoldersSynced: 0,
    contactFoldersSynced: 0,
    matterFoldersCreated: 0,
    contactFoldersCreated: 0,
    errors: [],
  };

  try {
    await syncMatterFolders(result);
    await syncContactFolders(result);

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary\n');
    console.log(`  Matters processed:         ${result.totalMatters}`);
    console.log(`  Matter folders synced:     ${result.matterFoldersSynced}`);
    console.log(`  Matter folders created:    ${result.matterFoldersCreated}`);
    console.log(`  Contacts processed:        ${result.totalContacts}`);
    console.log(`  Contact folders synced:    ${result.contactFoldersSynced}`);
    console.log(`  Contact folders created:   ${result.contactFoldersCreated}`);
    console.log(`  Errors:                    ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      result.errors.forEach((err) => {
        console.log(`  - ${err.type} ${err.id}: ${err.error}`);
      });
    }

    if (isDryRun) {
      console.log('\n🔍 This was a dry run. Run without --dry-run to apply changes.');
    } else {
      console.log('\n✅ Migration completed successfully!');
    }

  } catch (error) {
    console.error('\n❌ Fatal error during migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
