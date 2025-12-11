import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function linkDocumentsToMatters() {
  console.log("🔍 Finding documents without matter/contact links...\n");

  // Get all documents
  const documents = await prisma.document.findMany({
    where: {
      OR: [
        { matterId: null },
        { contactId: null },
      ],
    },
    include: {
      folder: {
        include: {
          matter: true,
          contact: true,
        },
      },
    },
  });

  console.log(`📄 Total orphaned documents: ${documents.length}\n`);

  let linkedCount = 0;

  for (const doc of documents) {
    console.log(`📎 Document: "${doc.displayName || doc.filename}"`);
    console.log(`   Folder: ${doc.folder?.name || "no folder"}`);

    if (!doc.folder) {
      console.log(`   ⚠️  No folder - cannot determine matter/contact\n`);
      continue;
    }

    // Link document to matter/contact based on folder's relationship
    const updates: any = {};

    if (doc.folder.matterId && !doc.matterId) {
      updates.matterId = doc.folder.matterId;
      console.log(`   ✅ Linking to matter: ${doc.folder.matter?.title || doc.folder.matterId}`);
    }

    if (doc.folder.contactId && !doc.contactId) {
      updates.contactId = doc.folder.contactId;
      console.log(`   ✅ Linking to contact: ${doc.folder.contactId}`);
    }

    if (Object.keys(updates).length > 0) {
      await prisma.document.update({
        where: { id: doc.id },
        data: updates,
      });
      linkedCount++;
      console.log(`   ✨ Updated!\n`);
    } else {
      console.log(`   ℹ️  No updates needed\n`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 Summary:");
  console.log(`   ✅ Documents linked: ${linkedCount}`);
  console.log(`   ⚠️  Still orphaned: ${documents.length - linkedCount}`);
  console.log("=".repeat(60));

  await prisma.$disconnect();
}

linkDocumentsToMatters()
  .then(() => {
    console.log("\n✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
