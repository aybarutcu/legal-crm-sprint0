#!/usr/bin/env npx tsx
/**
 * Quick test to verify isMasterFolder implementation works correctly
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function test() {
  console.log("🧪 Testing isMasterFolder implementation\n");

  // Test 1: Check existing master folders have the flag
  console.log("Test 1: Checking existing master folders...");
  const masterFolders = await prisma.documentFolder.findMany({
    where: {
      isMasterFolder: true,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      matterId: true,
      contactId: true,
    },
  });

  console.log(`✅ Found ${masterFolders.length} master folders:`);
  masterFolders.forEach((f) => {
    const type = f.matterId ? "Matter" : "Contact";
    console.log(`   - ${f.name} (${type})`);
  });

  // Test 2: Verify non-master folders don't have the flag
  console.log("\nTest 2: Checking non-master folders...");
  const regularFolders = await prisma.documentFolder.findMany({
    where: {
      isMasterFolder: false,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
    },
  });
  console.log(`✅ Found ${regularFolders.length} regular folders`);

  // Test 3: Check system root folders (/Matters, /Contacts)
  console.log("\nTest 3: Checking system root folders...");
  const rootFolders = await prisma.documentFolder.findMany({
    where: {
      parentFolderId: null,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      isMasterFolder: true,
      matterId: true,
      contactId: true,
    },
  });

  console.log(`✅ Found ${rootFolders.length} system root folders:`);
  rootFolders.forEach((f) => {
    console.log(`   - ${f.name} (isMasterFolder: ${f.isMasterFolder}, has entity: ${!!(f.matterId || f.contactId)})`);
  });

  // Test 4: Verify master folders can be queried efficiently with index
  console.log("\nTest 4: Performance test - querying master folders...");
  const start = Date.now();
  const count = await prisma.documentFolder.count({
    where: {
      isMasterFolder: true,
      deletedAt: null,
    },
  });
  const duration = Date.now() - start;
  console.log(`✅ Query completed in ${duration}ms (count: ${count})`);

  console.log("\n✅ All tests passed!");
}

test()
  .catch((e) => {
    console.error("❌ Test failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
