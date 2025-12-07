import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function updateDocumentDisplayNames() {
  console.log("Starting to update document display names...");

  // Find all documents that have tags but no displayName
  const documents = await prisma.document.findMany({
    where: {
      displayName: null,
      tags: {
        isEmpty: false,
      },
      deletedAt: null,
    },
    select: {
      id: true,
      filename: true,
      tags: true,
      workflowStepId: true,
    },
  });

  console.log(`Found ${documents.length} documents to update`);

  let updated = 0;
  for (const doc of documents) {
    console.log(`\nDocument ${doc.id}:`);
    console.log(`  Filename: ${doc.filename}`);
    console.log(`  Tags:`, doc.tags);
    
    let displayName: string | null = null;
    
    // New format: [requestId, documentName]
    if (doc.tags.length >= 2) {
      displayName = doc.tags[1];
      console.log(`  Format: New (two tags)`);
    }
    // Old format: single tag like "stepId-document-name"
    else if (doc.tags.length === 1 && doc.tags[0].includes('-')) {
      const tag = doc.tags[0];
      // Try to extract the document name part after the first dash sequence
      // Format: "cmiu5sesg00161377p8xmwlec-government-issued-id"
      // We want: "government-issued-id"
      const parts = tag.split('-');
      if (parts.length > 1) {
        // The first part is the stepId (looks like a cuid), rest is the document name
        // Step IDs are typically 25 chars, so if first part is long, it's the stepId
        if (parts[0].length > 15) {
          displayName = parts.slice(1).join('-');
        } else {
          // Might be a document name with dashes (like "Government-issued ID")
          displayName = tag;
        }
        // Capitalize and format nicely
        displayName = displayName
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
      console.log(`  Format: Old (single tag)`);
    }
    
    if (displayName) {
      await prisma.document.update({
        where: { id: doc.id },
        data: { displayName },
      });
      console.log(`  ✓ Updated: "${doc.filename}" -> "${displayName}"`);
      updated++;
    } else {
      console.log(`  ✗ Skipped: Could not determine display name`);
    }
  }

  console.log(`\nUpdated ${updated} documents with display names`);
}

updateDocumentDisplayNames()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
