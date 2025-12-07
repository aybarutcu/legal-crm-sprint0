import { prisma } from '../lib/prisma';
import type { Prisma } from '@prisma/client';

async function simulateApiQuery() {
  const folderId = 'cmivldpjb0009jmu96frbwppj';
  
  console.log('🔍 Simulating API query for folder:', folderId, '\n');
  
  // Simulate the exact WHERE clause from the API
  const where: Prisma.DocumentWhereInput = {
    deletedAt: null,
    folderId,
  };
  
  console.log('WHERE clause:', JSON.stringify(where, null, 2), '\n');
  
  // Fetch all documents (same as API)
  const allDocuments = await prisma.document.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      filename: true,
      displayName: true,
      version: true,
      parentDocumentId: true,
      createdAt: true,
    },
  });
  
  console.log(`Fetched ${allDocuments.length} documents from DB:\n`);
  allDocuments.forEach(doc => {
    console.log(`  ${doc.displayName || doc.filename} (v${doc.version})`);
    console.log(`    ID: ${doc.id.substring(0, 8)}, Parent: ${doc.parentDocumentId?.substring(0, 8) || 'null'}`);
  });
  
  console.log('\n--- Applying version grouping logic ---\n');
  
  // Group by root document and keep only latest version (same as API)
  const latestVersionsMap = new Map<string, typeof allDocuments[0]>();
  
  for (const doc of allDocuments) {
    const rootId = doc.parentDocumentId || doc.id;
    const existing = latestVersionsMap.get(rootId);
    
    console.log(`Processing: ${doc.displayName || doc.filename} (v${doc.version})`);
    console.log(`  RootID: ${rootId.substring(0, 8)}`);
    console.log(`  Existing: ${existing ? `v${existing.version}` : 'none'}`);
    
    if (!existing || doc.version > existing.version) {
      latestVersionsMap.set(rootId, doc);
      console.log(`  ✅ KEPT\n`);
    } else {
      console.log(`  ❌ FILTERED OUT\n`);
    }
  }
  
  const documents = Array.from(latestVersionsMap.values());
  
  console.log(`\n📊 Final result: ${documents.length} documents\n`);
  documents.forEach(doc => {
    console.log(`  ✓ ${doc.displayName || doc.filename} (v${doc.version}) - ${doc.id.substring(0, 8)}`);
  });
  
  await prisma.$disconnect();
}

simulateApiQuery().catch(console.error);
