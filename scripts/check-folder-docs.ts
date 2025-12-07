import { prisma } from '../lib/prisma';

async function checkFolderDocs() {
  const folderId = 'cmivldpjb0009jmu96frbwppj';
  
  console.log(`📁 Checking documents in folder: ${folderId}\n`);
  
  const docs = await prisma.document.findMany({
    where: {
      folderId,
      deletedAt: null,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      filename: true,
      displayName: true,
      version: true,
      parentDocumentId: true,
      createdAt: true,
    },
  });
  
  console.log(`Found ${docs.length} documents:\n`);
  
  for (const doc of docs) {
    console.log(`${doc.displayName || doc.filename}`);
    console.log(`  ID: ${doc.id.substring(0, 8)}`);
    console.log(`  Version: v${doc.version}`);
    console.log(`  Parent: ${doc.parentDocumentId?.substring(0, 8) || 'null'}`);
    console.log(`  Created: ${doc.createdAt.toISOString()}`);
    console.log('');
  }
  
  await prisma.$disconnect();
}

checkFolderDocs().catch(console.error);
