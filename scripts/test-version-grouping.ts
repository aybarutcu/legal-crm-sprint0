import { prisma } from '../lib/prisma';

async function testVersionGrouping() {
  console.log('🔍 Testing version grouping logic...\n');
  
  // Get all documents
  const allDocuments = await prisma.document.findMany({
    where: { deletedAt: null },
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
  
  console.log(`Total documents: ${allDocuments.length}\n`);
  
  // Group by root document and keep only latest version
  const latestVersionsMap = new Map<string, typeof allDocuments[0]>();
  
  for (const doc of allDocuments) {
    const rootId = doc.parentDocumentId || doc.id;
    const existing = latestVersionsMap.get(rootId);
    
    console.log(`Processing: ${doc.displayName || doc.filename}`);
    console.log(`  ID: ${doc.id.substring(0, 8)}`);
    console.log(`  Version: v${doc.version}`);
    console.log(`  ParentDocumentId: ${doc.parentDocumentId?.substring(0, 8) || 'null'}`);
    console.log(`  RootID: ${rootId.substring(0, 8)}`);
    console.log(`  Existing in map: ${existing ? `v${existing.version}` : 'none'}`);
    
    if (!existing || doc.version > existing.version) {
      latestVersionsMap.set(rootId, doc);
      console.log(`  ✅ KEPT (version ${doc.version} > ${existing?.version || 0})`);
    } else {
      console.log(`  ❌ SKIPPED (version ${doc.version} <= ${existing.version})`);
    }
    console.log('');
  }
  
  console.log(`\n📊 Result: ${latestVersionsMap.size} documents after grouping\n`);
  
  for (const [rootId, doc] of latestVersionsMap) {
    console.log(`✓ ${doc.displayName || doc.filename} (v${doc.version})`);
  }
  
  await prisma.$disconnect();
}

testVersionGrouping().catch(console.error);
