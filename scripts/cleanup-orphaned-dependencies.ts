import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanupOrphanedDependencies() {
  console.log("Cleanup script disabled - dependencies are now stored in separate tables");
  console.log("Use WorkflowTemplateDependency and WorkflowInstanceDependency tables instead");

  // TODO: Update this script to work with the new dependency table structure

  console.log("Cleanup complete.");
}

cleanupOrphanedDependencies()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
