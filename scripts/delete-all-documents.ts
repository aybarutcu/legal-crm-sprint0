#!/usr/bin/env tsx
/**
 * Script to delete all documents from the database
 * 
 * Usage:
 *   npx tsx scripts/delete-all-documents.ts [--hard]
 * 
 * Options:
 *   --hard    Permanently delete from database (default: soft delete)
 */

import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();
const isHardDelete = process.argv.includes('--hard');

async function main() {
  console.log('🗑️  Document Deletion Script\n');
  console.log('============================================================\n');
  
  if (isHardDelete) {
    console.log('⚠️  HARD DELETE MODE - Documents will be permanently removed!\n');
  } else {
    console.log('🔄 SOFT DELETE MODE - Documents will be marked as deleted\n');
  }

  // Get count of all documents
  const totalDocs = await prisma.document.count();
  const nonDeletedDocs = await prisma.document.count({
    where: { deletedAt: null }
  });

  console.log(`📊 Current State:`);
  console.log(`   Total documents in DB: ${totalDocs}`);
  console.log(`   Non-deleted documents: ${nonDeletedDocs}`);
  console.log(`   Already deleted: ${totalDocs - nonDeletedDocs}\n`);

  if (nonDeletedDocs === 0 && !isHardDelete) {
    console.log('✅ No documents to soft delete (all already marked as deleted)\n');
    
    const choice = await promptUser('Do you want to permanently delete all documents? (yes/no): ');
    if (choice !== 'yes') {
      console.log('❌ Aborted\n');
      await prisma.$disconnect();
      process.exit(0);
    }
    
    console.log('\n🗑️  Permanently deleting all documents...\n');
    
    const deleted = await prisma.document.deleteMany({});
    
    console.log(`✅ Deleted ${deleted.count} documents permanently\n`);
    
    await prisma.$disconnect();
    process.exit(0);
  }

  // Confirm deletion
  const confirmMessage = isHardDelete
    ? `Are you sure you want to PERMANENTLY delete ${totalDocs} documents? (yes/no): `
    : `Are you sure you want to soft delete ${nonDeletedDocs} documents? (yes/no): `;
    
  const confirmation = await promptUser(confirmMessage);
  
  if (confirmation !== 'yes') {
    console.log('❌ Aborted\n');
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log('\n🗑️  Deleting documents...\n');

  if (isHardDelete) {
    // Hard delete - permanently remove from database
    const deleted = await prisma.document.deleteMany({});
    console.log(`✅ Deleted ${deleted.count} documents permanently\n`);
  } else {
    // Soft delete - mark as deleted
    const updated = await prisma.document.updateMany({
      where: { deletedAt: null },
      data: {
        deletedAt: new Date(),
        deletedBy: null, // No user context in script
      },
    });
    console.log(`✅ Soft deleted ${updated.count} documents\n`);
  }

  // Show final state
  const remainingDocs = await prisma.document.count({
    where: { deletedAt: null }
  });
  const totalAfter = await prisma.document.count();

  console.log(`📊 Final State:`);
  console.log(`   Total documents in DB: ${totalAfter}`);
  console.log(`   Non-deleted documents: ${remainingDocs}`);
  console.log(`   Deleted documents: ${totalAfter - remainingDocs}\n`);

  console.log('✅ Done!\n');
  
  await prisma.$disconnect();
}

function promptUser(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(question, (answer: string) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
