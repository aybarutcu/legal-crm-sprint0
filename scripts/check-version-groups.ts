import { prisma } from '../lib/prisma';

async function checkVersionGroups() {
  console.log('📊 Checking version groups...\n');
  
  const docs = await prisma.document.findMany({
    where: { deletedAt: null },
    orderBy: [
      { displayName: 'asc' },
      { version: 'asc' }
    ],
    select: {
      id: true,
      filename: true,
      displayName: true,
      version: true,
      parentDocumentId: true,
    },
  });
  
  // Group by root document
  const groups = new Map<string, typeof docs>();
  
  for (const doc of docs) {
    const rootId = doc.parentDocumentId || doc.id;
    if (!groups.has(rootId)) {
      groups.set(rootId, []);
    }
    groups.get(rootId)!.push(doc);
  }
  
  console.log(`Found ${groups.size} version groups:\n`);
  
  for (const [rootId, versions] of groups) {
    const root = versions.find(v => v.id === rootId) || versions[0];
    console.log(`📁 Group: ${root.displayName || root.filename}`);
    console.log(`   Root ID: ${rootId.substring(0, 8)}...`);
    console.log(`   Versions: ${versions.length}`);
    
    for (const ver of versions) {
      const isRoot = ver.id === rootId;
      console.log(`     ${isRoot ? '└─' : '  '} v${ver.version}: ${ver.filename.substring(0, 30)}... (${ver.id.substring(0, 8)})`);
    }
    console.log('');
  }
  
  await prisma.$disconnect();
}

checkVersionGroups().catch(console.error);
