import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fixCrossTemplateDependency() {
  console.log("Script disabled - dependencies are now stored in separate WorkflowTemplateDependency table");
  console.log("Cross-template dependencies should be handled differently in the new system");

  // TODO: Update this script to work with WorkflowTemplateDependency table

  await prisma.$disconnect();
}

fixCrossTemplateDependency().catch(console.error);
