import { prisma } from "../lib/prisma";

async function main() {
  const stepId = "cmj0drj8600044jp5ulaj9h87";
  const matterId = "cmixby3p1000p13ompcgjaz9d";
  
  // Get the step's config
  const step = await prisma.workflowInstanceStep.findUnique({
    where: { id: stepId },
    select: { actionData: true },
  });
  
  if (!step) {
    console.log("Step not found");
    return;
  }
  
  const actionData = step.actionData as any;
  const documentNames = actionData.config.documentNames;
  
  console.log("📋 Requested document names:");
  documentNames.forEach((name: string, i: number) => {
    console.log(`  ${i + 1}. "${name}" (length: ${name.length})`);
  });
  
  console.log("\n📄 Existing documents in matter:");
  const existingDocs = await prisma.document.findMany({
    where: {
      matterId,
      deletedAt: null,
    },
    select: {
      displayName: true,
      version: true,
      id: true,
      workflowStepId: true,
    },
    orderBy: { displayName: 'asc' },
  });
  
  existingDocs.forEach((doc) => {
    console.log(`  - "${doc.displayName}" v${doc.version} (length: ${doc.displayName.length}, id: ${doc.id})`);
  });
  
  console.log("\n🔍 Checking matches:");
  for (const requestedName of documentNames) {
    const match = await prisma.document.findFirst({
      where: {
        matterId,
        displayName: requestedName,
        deletedAt: null,
      },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, displayName: true },
    });
    
    if (match) {
      console.log(`  ✅ "${requestedName}" → Found: v${match.version}, id: ${match.id}`);
    } else {
      console.log(`  ❌ "${requestedName}" → NOT FOUND`);
      
      // Try fuzzy match
      const fuzzyMatch = existingDocs.find(
        doc => doc.displayName.toLowerCase().trim() === requestedName.toLowerCase().trim()
      );
      if (fuzzyMatch) {
        console.log(`     (But found case-insensitive match: "${fuzzyMatch.displayName}")`);
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
