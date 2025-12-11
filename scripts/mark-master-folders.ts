import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function markMasterFolders() {
  console.log("🔧 Marking matter and contact folders as master folders...\n");

  // Mark all matter folders as master
  const matterFolders = await prisma.documentFolder.findMany({
    where: {
      matterId: { not: null },
      isMasterFolder: false,
    },
    select: { id: true, name: true, matterId: true },
  });

  console.log(`Found ${matterFolders.length} matter folders to update`);
  
  for (const folder of matterFolders) {
    await prisma.documentFolder.update({
      where: { id: folder.id },
      data: { isMasterFolder: true },
    });
    console.log(`  ✅ ${folder.name} → isMasterFolder: true`);
  }

  // Mark all contact folders as master
  const contactFolders = await prisma.documentFolder.findMany({
    where: {
      contactId: { not: null },
      isMasterFolder: false,
    },
    select: { id: true, name: true, contactId: true },
  });

  console.log(`\nFound ${contactFolders.length} contact folders to update`);
  
  for (const folder of contactFolders) {
    await prisma.documentFolder.update({
      where: { id: folder.id },
      data: { isMasterFolder: true },
    });
    console.log(`  ✅ ${folder.name} → isMasterFolder: true`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 Summary:");
  console.log(`   ✅ Matter folders updated: ${matterFolders.length}`);
  console.log(`   ✅ Contact folders updated: ${contactFolders.length}`);
  console.log("=".repeat(60));

  await prisma.$disconnect();
}

markMasterFolders()
  .then(() => {
    console.log("\n✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
