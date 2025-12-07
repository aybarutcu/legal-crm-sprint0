import { prisma } from '../lib/prisma';

async function cleanFolders() {
  console.log('🗂️  Cleaning document folders...\n');
  
  // Count folders
  const folderCount = await prisma.documentFolder.count({
    where: { deletedAt: null }
  });
  
  console.log(`Found ${folderCount} folders`);
  
  if (folderCount > 0) {
    // Delete all folders
    const result = await prisma.documentFolder.deleteMany({});
    console.log(`✅ Deleted ${result.count} folders`);
  }
  
  // Verify cleanup
  const remainingDocs = await prisma.document.count();
  const remainingFolders = await prisma.documentFolder.count();
  
  console.log('\n📊 Final state:');
  console.log(`  Documents: ${remainingDocs}`);
  console.log(`  Folders: ${remainingFolders}`);
  console.log(`  Access Grants: ${await prisma.documentAccessGrant.count()}`);
  
  await prisma.$disconnect();
}

cleanFolders().catch(console.error);
