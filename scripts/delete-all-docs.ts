import { prisma } from '../lib/prisma';

async function deleteAllDocs() {
  console.log('🗑️  Deleting all documents...\n');
  
  // Count documents before deletion
  const count = await prisma.document.count({
    where: { deletedAt: null }
  });
  
  console.log(`Found ${count} active documents`);
  
  if (count === 0) {
    console.log('No documents to delete.');
    await prisma.$disconnect();
    return;
  }
  
  // Hard delete all documents (including soft-deleted ones)
  const result = await prisma.document.deleteMany({});
  
  console.log(`✅ Deleted ${result.count} documents`);
  
  // Also delete document access grants
  const accessResult = await prisma.documentAccessGrant.deleteMany({});
  console.log(`✅ Deleted ${accessResult.count} access grants`);
  
  await prisma.$disconnect();
}

deleteAllDocs().catch(console.error);
