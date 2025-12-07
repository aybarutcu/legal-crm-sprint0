#!/usr/bin/env npx tsx
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkDuplicates() {
  console.log("Checking for duplicate matter folders...\n");

  const folders = await prisma.documentFolder.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      matterId: true,
      contactId: true,
      parentFolderId: true,
      isMasterFolder: true,
    },
  });

  // Group folders by matterId
  const matterFolderGroups: Record<string, typeof folders> = {};
  folders.forEach((f) => {
    if (f.matterId) {
      if (!matterFolderGroups[f.matterId]) {
        matterFolderGroups[f.matterId] = [];
      }
      matterFolderGroups[f.matterId].push(f);
    }
  });

  // Check for duplicates
  let foundDuplicates = false;
  Object.keys(matterFolderGroups).forEach((matterId) => {
    const matterFolders = matterFolderGroups[matterId];
    if (matterFolders.length > 1) {
      console.log(`❌ Matter ${matterId} has ${matterFolders.length} folders:`);
      matterFolders.forEach((f) => console.log(`   - ${f.name} (${f.id})`));
      foundDuplicates = true;
    }
  });

  if (!foundDuplicates) {
    console.log("✅ No duplicate matter folders found");

    const matterFolders = folders.filter((f) => f.matterId && f.parentFolderId);
    console.log(`\nTotal matter folders: ${matterFolders.length}`);

    const withoutFlag = matterFolders.filter((f) => !f.isMasterFolder);
    if (withoutFlag.length > 0) {
      console.log(`⚠️  ${withoutFlag.length} matter folders without isMasterFolder flag:`);
      withoutFlag.forEach((f) => console.log(`   - ${f.name} (${f.id.substring(0, 10)}...)`));
    } else {
      console.log("✅ All matter folders have isMasterFolder flag");
    }
  }
}

checkDuplicates()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
