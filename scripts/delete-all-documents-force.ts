#!/usr/bin/env tsx
/**
 * Script to permanently delete all documents from the database
 * This is useful for clearing test data or resetting the documents table
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Deleting ALL Documents\n');

  // Get current count
  const totalDocs = await prisma.document.count();
  const nonDeletedDocs = await prisma.document.count({
    where: { deletedAt: null }
  });

  console.log(`📊 Found:`);
  console.log(`   Total: ${totalDocs} documents`);
  console.log(`   Active: ${nonDeletedDocs} documents`);
  console.log(`   Deleted: ${totalDocs - nonDeletedDocs} documents\n`);

  if (totalDocs === 0) {
    console.log('✅ No documents to delete\n');
    await prisma.$disconnect();
    return;
  }

  console.log('🗑️  Permanently deleting all documents...\n');

  // Permanently delete all documents
  const result = await prisma.document.deleteMany({});

  console.log(`✅ Deleted ${result.count} documents permanently\n`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
