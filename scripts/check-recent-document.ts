import { prisma } from '../lib/prisma';

async function checkRecentDocument() {
  console.log('📄 Checking most recent document...\n');
  
  const doc = await prisma.document.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: {
      folder: { select: { id: true, name: true } },
      matter: { select: { id: true, title: true } },
    },
  });
  
  if (!doc) {
    console.log('❌ No documents found');
    await prisma.$disconnect();
    return;
  }
  
  console.log('Latest Document:');
  console.log('  ID:', doc.id);
  console.log('  Filename:', doc.filename);
  console.log('  Display Name:', doc.displayName);
  console.log('  Version:', doc.version);
  console.log('  Parent Doc ID:', doc.parentDocumentId);
  console.log('  Tags:', doc.tags);
  console.log('\nLocation:');
  console.log('  Folder ID:', doc.folderId);
  console.log('  Folder Name:', doc.folder?.name || 'N/A');
  console.log('  Matter ID:', doc.matterId);
  console.log('  Matter Title:', doc.matter?.title || 'N/A');
  
  await prisma.$disconnect();
}

checkRecentDocument().catch(console.error);
