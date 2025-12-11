import { prisma } from "../lib/prisma";
import "@/lib/workflows"; // Initialize handlers

async function main() {
  const stepId = "cmj0drj8600044jp5ulaj9h87";
  
  // Get the step
  const step = await prisma.workflowInstanceStep.findUnique({
    where: { id: stepId },
    include: {
      instance: true,
      templateStep: true,
    },
  });
  
  if (!step) {
    console.log("Step not found");
    return;
  }
  
  console.log("Step state:", step.actionState);
  console.log("Step type:", step.actionType);
  console.log("Matter ID:", step.instance.matterId);
  
  const actionData = step.actionData as any;
  const documentNames = actionData.config.documentNames as string[];
  
  console.log("\n📋 Re-running document detection logic:");
  
  const documentsStatus: any[] = [];
  
  for (const name of documentNames) {
    const requestId = `${step.id}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    
    // Look for existing document with same displayName
    const existingDoc = await prisma.document.findFirst({
      where: {
        matterId: step.instance.matterId!,
        displayName: name,
        deletedAt: null,
      },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, createdAt: true },
    });
    
    if (existingDoc) {
      console.log(`  ✅ "${name}" → Found v${existingDoc.version} (${existingDoc.id})`);
      documentsStatus.push({
        requestId,
        documentName: name,
        uploaded: true,
        documentId: existingDoc.id,
        uploadedAt: existingDoc.createdAt.toISOString(),
        version: existingDoc.version,
      });
    } else {
      console.log(`  ❌ "${name}" → Not found`);
      documentsStatus.push({
        requestId,
        documentName: name,
        uploaded: false,
        version: 0,
      });
    }
  }
  
  const allUploaded = documentsStatus.every(d => d.uploaded);
  
  console.log("\n📊 Results:");
  console.log(`  All uploaded: ${allUploaded}`);
  console.log(`  Status: ${JSON.stringify(documentsStatus, null, 2)}`);
  
  console.log("\n💾 Updating step...");
  
  const updatedActionData = {
    config: actionData.config,
    data: {
      documentsStatus,
      allDocumentsUploaded: allUploaded,
      status: allUploaded ? "COMPLETED" : "IN_PROGRESS",
    },
    history: actionData.history || [],
  };
  
  await prisma.workflowInstanceStep.update({
    where: { id: stepId },
    data: {
      actionData: updatedActionData as any,
      ...(allUploaded ? { actionState: "COMPLETED", completedAt: new Date() } : {}),
    },
  });
  
  console.log("✅ Step updated successfully!");
  
  if (allUploaded) {
    console.log("\n🔄 Step is now complete, should activate dependent steps...");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
