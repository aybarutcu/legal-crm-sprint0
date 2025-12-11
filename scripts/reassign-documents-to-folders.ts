import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function reassignDocumentsToFolders() {
  console.log("🔍 Finding documents with orphaned folder references...\n");

  // Get all documents
  const documents = await prisma.document.findMany({
    where: {
      OR: [
        { folderId: { not: null } },
        { matterId: { not: null } },
        { contactId: { not: null } },
      ],
    },
    include: {
      folder: true,
      matter: true,
      contact: true,
    },
  });

  console.log(`📄 Total documents to check: ${documents.length}\n`);

  let reassignedCount = 0;
  let orphanedCount = 0;
  let alreadyCorrectCount = 0;

  for (const doc of documents) {
    // Check if document has a folderId but folder doesn't exist
    if (doc.folderId && !doc.folder) {
      console.log(`❌ Orphaned: "${doc.displayName || doc.filename}" (folderId: ${doc.folderId} - folder deleted)`);
      orphanedCount++;

      // Find the correct folder based on matter or contact
      let correctFolder = null;

      if (doc.matterId) {
        // Find the matter's folder
        correctFolder = await prisma.documentFolder.findFirst({
          where: {
            matterId: doc.matterId,
            parentFolderId: { not: null }, // The matter's main folder (not the root "Matters" folder)
          },
        });
      } else if (doc.contactId) {
        // Find the contact's folder
        correctFolder = await prisma.documentFolder.findFirst({
          where: {
            contactId: doc.contactId,
            parentFolderId: { not: null }, // The contact's main folder (not the root "Contacts" folder)
          },
        });
      }

      if (correctFolder) {
        // Reassign document to correct folder
        await prisma.document.update({
          where: { id: doc.id },
          data: { folderId: correctFolder.id },
        });
        console.log(`  ✅ Reassigned to folder: ${correctFolder.name} (${correctFolder.id})\n`);
        reassignedCount++;
      } else {
        console.log(`  ⚠️  No folder found for this document's ${doc.matterId ? 'matter' : 'contact'}\n`);
      }
    } else if (doc.folder) {
      // Document has valid folder reference
      alreadyCorrectCount++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 Summary:");
  console.log(`   ✅ Already correct: ${alreadyCorrectCount}`);
  console.log(`   🔧 Reassigned: ${reassignedCount}`);
  console.log(`   ⚠️  Still orphaned: ${orphanedCount - reassignedCount}`);
  console.log("=".repeat(60));

  await prisma.$disconnect();
}

reassignDocumentsToFolders()
  .then(() => {
    console.log("\n✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
