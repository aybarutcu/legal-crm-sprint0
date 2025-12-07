#!/usr/bin/env tsx
/**
 * Script to set isMasterFolder=true for existing master folders.
 * 
 * A master folder is a folder that:
 * - Has a matterId or contactId (is linked to an entity)
 * - Has a parentFolder whose parentFolderId is null (is a child of a system root)
 * 
 * Usage:
 *   tsx scripts/set-master-folder-flags.ts [--dry-run]
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log(isDryRun ? "🔍 DRY RUN MODE - No changes will be made" : "✏️  LIVE MODE - Database will be updated");
  console.log("");

  // Find all folders that should be master folders
  const candidates = await prisma.documentFolder.findMany({
    where: {
      OR: [
        { matterId: { not: null } },
        { contactId: { not: null } },
      ],
      isMasterFolder: false, // Only find folders not yet marked
    },
    include: {
      parentFolder: true,
    },
  });

  console.log(`Found ${candidates.length} potential master folders to update\n`);

  const masterFolders = candidates.filter((folder) => {
    // Master folder = has matter/contact AND parent is a system root (parent's parent is null)
    return folder.parentFolder && folder.parentFolder.parentFolderId === null;
  });

  console.log(`Identified ${masterFolders.length} actual master folders:\n`);

  for (const folder of masterFolders) {
    const entityType = folder.matterId ? "Matter" : "Contact";
    const entityId = folder.matterId || folder.contactId;
    console.log(`  - ${folder.name} (${entityType} ${entityId})`);
  }

  if (masterFolders.length === 0) {
    console.log("\n✅ No master folders to update!");
    return;
  }

  if (!isDryRun) {
    console.log("\nUpdating master folder flags...");
    
    const result = await prisma.documentFolder.updateMany({
      where: {
        id: {
          in: masterFolders.map((f) => f.id),
        },
      },
      data: {
        isMasterFolder: true,
      },
    });

    console.log(`\n✅ Updated ${result.count} folders`);
  } else {
    console.log("\n🔍 Dry run complete - no changes made");
    console.log(`   Run without --dry-run to update ${masterFolders.length} folders`);
  }
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
