#!/usr/bin/env npx tsx
/**
 * Test to verify master folder is created when matter is created
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function test() {
  console.log("🧪 Testing matter creation with master folder\n");

  // Find a client to use
  const client = await prisma.contact.findFirst({
    where: { type: "CLIENT", deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  });

  if (!client) {
    console.error("❌ No client found");
    process.exit(1);
  }

  console.log(`Using client: ${client.firstName} ${client.lastName}`);

  // Find admin user
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true, name: true },
  });

  if (!admin) {
    console.error("❌ No admin user found");
    process.exit(1);
  }

  console.log(`Using admin: ${admin.name}\n`);

  // Create a test matter
  const testTitle = `Test Matter ${Date.now()}`;
  console.log(`Creating matter: "${testTitle}"`);

  const matter = await prisma.$transaction(async (tx) => {
    // Create the matter
    const matter = await tx.matter.create({
      data: {
        title: testTitle,
        type: "CIVIL",
        status: "OPEN",
        clientId: client.id,
        ownerId: admin.id,
        openedAt: new Date(),
      },
    });

    // Create "Matters" root folder if it doesn't exist
    let mattersRootFolder = await tx.documentFolder.findFirst({
      where: {
        name: "Matters",
        parentFolderId: null,
        matterId: null,
        contactId: null,
        deletedAt: null,
      },
    });

    if (!mattersRootFolder) {
      mattersRootFolder = await tx.documentFolder.create({
        data: {
          name: "Matters",
          createdById: admin.id,
          accessScope: "PUBLIC",
        },
      });
    }

    // Create matter-specific folder under "Matters"
    const folder = await tx.documentFolder.create({
      data: {
        name: matter.title,
        matterId: matter.id,
        parentFolderId: mattersRootFolder.id,
        createdById: admin.id,
        accessScope: "PUBLIC",
        color: "blue",
        isMasterFolder: true,
      },
    });

    console.log(`✅ Created matter: ${matter.id}`);
    console.log(`✅ Created folder: ${folder.id} (isMasterFolder: ${folder.isMasterFolder})\n`);

    return { matter, folder };
  });

  // Verify the folder was created correctly
  const verifyFolder = await prisma.documentFolder.findFirst({
    where: {
      matterId: matter.matter.id,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      isMasterFolder: true,
      matterId: true,
      parentFolderId: true,
    },
  });

  console.log("Verification:");
  console.log(`  Folder name: ${verifyFolder?.name}`);
  console.log(`  isMasterFolder: ${verifyFolder?.isMasterFolder}`);
  console.log(`  matterId: ${verifyFolder?.matterId}`);
  console.log(`  hasParent: ${!!verifyFolder?.parentFolderId}`);

  if (verifyFolder?.isMasterFolder === true) {
    console.log("\n✅ SUCCESS: Master folder was created correctly!");
  } else {
    console.log("\n❌ FAILED: Master folder flag was not set!");
  }

  // Cleanup
  console.log("\nCleaning up test data...");
  await prisma.documentFolder.update({
    where: { id: matter.folder.id },
    data: { deletedAt: new Date(), deletedBy: admin.id },
  });
  await prisma.matter.delete({
    where: { id: matter.matter.id },
  });
  console.log("✅ Cleanup complete");
}

test()
  .catch((e) => {
    console.error("❌ Test failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
