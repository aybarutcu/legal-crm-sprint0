import { prisma } from '../lib/prisma';

async function checkVersions() {
  const docs = await prisma.document.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      filename: true,
      displayName: true,
      version: true,
      parentDocumentId: true,
      tags: true,
      createdAt: true
    },
    orderBy: [{ createdAt: 'desc' }],
    take: 30
  });
  
  console.log('\n📄 All Recent Documents:');
  docs.forEach((d, i) => {
    console.log(`${i + 1}. ${d.filename.substring(0, 40)}`);
    console.log(`   DisplayName: ${d.displayName || '(null)'}`);
    console.log(`   Version: v${d.version}, Parent: ${d.parentDocumentId ? 'YES ('+d.parentDocumentId.substring(0,8)+')' : 'NO'}`);
    console.log(`   Tags: [${d.tags.join(', ')}]`);
    console.log(`   ID: ${d.id}\n`);
  });
  
  await prisma.$disconnect();
}

checkVersions().catch(console.error);
