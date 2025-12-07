import { prisma } from '../lib/prisma';

async function verify() {
  const docs = await prisma.document.count();
  const folders = await prisma.documentFolder.count();
  
  console.log('\n✨ Database cleaned!');
  console.log(`  Documents: ${docs}`);
  console.log(`  Folders: ${folders}`);
  console.log('\nYou can now upload new documents with the new versioning system.\n');
  
  await prisma.$disconnect();
}

verify().catch(console.error);
