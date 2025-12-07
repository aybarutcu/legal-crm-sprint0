import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testLeadWorkflow() {
  console.log("Test script disabled - needs updates for new workflow system");
  console.log("Workflow system now uses dependencies instead of order-based sequencing");
  
  await prisma.$disconnect();
}

testLeadWorkflow().catch(console.error);
