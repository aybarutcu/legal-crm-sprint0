import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testNewTemplateFromSource() {
  console.log("Test script disabled - needs updates for new workflow system");
  console.log("Template copying needs to be updated for dependency tables");
  
  await prisma.$disconnect();
}

testNewTemplateFromSource().catch(console.error);
