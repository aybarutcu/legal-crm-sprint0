import { prisma } from "../lib/prisma";

async function main() {
  const stepId = "cmixcp6g1001vkgpt55botmr8";
  
  // Get the current step
  const step = await prisma.workflowInstanceStep.findUnique({
    where: { id: stepId },
  });
  
  if (!step) {
    console.log("Step not found");
    return;
  }
  
  const actionData = step.actionData as any;
  const documentsStatus = actionData.data.documentsStatus;
  
  // Update the "Supporting documentation" status
  const supportingDoc = documentsStatus.find(
    (d: any) => d.documentName === "Supporting documentation related to your legal matter"
  );
  
  if (supportingDoc) {
    supportingDoc.uploaded = true;
    supportingDoc.documentId = "b5a4d701-2165-41fb-a9ee-148c49c1a7b6";
    supportingDoc.uploadedAt = "2025-12-08T15:57:24.394Z";
    supportingDoc.version = 1;
    
    console.log("Updated documentsStatus:", JSON.stringify(documentsStatus, null, 2));
    
    // Update the step
    await prisma.workflowInstanceStep.update({
      where: { id: stepId },
      data: { actionData },
    });
    
    console.log("✅ Updated workflow step actionData");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
