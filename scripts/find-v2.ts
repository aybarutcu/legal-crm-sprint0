import { prisma } from '../lib/prisma';

async function findV2() {
  const docs = await prisma.document.findMany({
    where: { 
      deletedAt: null,
      version: { gt: 1 }
    },
    select: {
      id: true,
      filename: true,
      displayName: true,
      version: true,
      parentDocumentId: true,
      tags: true,
    },
  });
  
  console.log(`\nFound ${docs.length} documents with version > 1:`);
  docs.forEach(d => {
    console.log(`\n${d.filename}`);
    console.log(`  DisplayName: ${d.displayName || '(null)'}`);
    console.log(`  Version: v${d.version}`);
    console.log(`  ParentId: ${d.parentDocumentId || '(null)'}`);
    console.log(`  Tags: [${d.tags.join(', ')}]`);
  });
  
  await prisma.$disconnect();
}

findV2().catch(console.error);
