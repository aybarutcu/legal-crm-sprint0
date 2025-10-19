/**
 * Script to complete the first READY step in a contact's workflow
 * Useful for testing workflow progression
 */

import { PrismaClient, ActionType, ActionState } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const contactId = process.argv[2];
  
  if (!contactId) {
    console.error("Usage: npx tsx scripts/complete-lead-workflow-step.ts <contactId>");
    process.exit(1);
  }

  console.log(`\n🔍 Finding workflow for contact: ${contactId}\n`);

  // Find contact with active workflow
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: {
      workflowInstances: {
        where: { status: "ACTIVE" },
        include: {
          steps: {
            orderBy: { order: "asc" },
          },
          template: true,
        },
      },
    },
  });

  if (!contact) {
    console.error("❌ Contact not found");
    process.exit(1);
  }

  if (!contact.workflowInstances.length) {
    console.error("❌ No active workflows found for this contact");
    process.exit(1);
  }

  const workflow = contact.workflowInstances[0];
  console.log(`📋 Workflow: ${workflow.template.name}`);
  console.log(`   Status: ${workflow.status}\n`);

  // Find first READY or IN_PROGRESS step
  const activeStep = workflow.steps.find(
    (s) => s.actionState === ActionState.READY || s.actionState === ActionState.IN_PROGRESS
  );

  if (!activeStep) {
    console.log("✅ All steps completed!");
    process.exit(0);
  }

  console.log(`🔄 Completing: Step ${activeStep.order} - ${activeStep.title}`);
  console.log(`   Type: ${activeStep.actionType}`);
  console.log(`   State: ${activeStep.actionState}\n`);

  // Complete the step based on type
  if (activeStep.actionType === ActionType.CHECKLIST) {
    const actionData = activeStep.actionData as { items?: string[] };
    const items = actionData?.items || [];

    await prisma.workflowInstanceStep.update({
      where: { id: activeStep.id },
      data: {
        actionState: ActionState.COMPLETED,
        completedAt: new Date(),
        actionData: {
          ...actionData,
          checkedItems: Array.from({ length: items.length }, (_, i) => i),
        },
      },
    });
    console.log(`✅ Checklist completed (${items.length} items checked)`);
  } else if (activeStep.actionType === ActionType.APPROVAL_LAWYER) {
    await prisma.workflowInstanceStep.update({
      where: { id: activeStep.id },
      data: {
        actionState: ActionState.COMPLETED,
        completedAt: new Date(),
        actionData: {
          ...((activeStep.actionData as object) || {}),
          approved: true,
          approvedAt: new Date().toISOString(),
          comments: "Automated test approval",
        },
      },
    });
    console.log("✅ Approval completed");
  } else {
    // Generic completion for other types
    await prisma.workflowInstanceStep.update({
      where: { id: activeStep.id },
      data: {
        actionState: ActionState.COMPLETED,
        completedAt: new Date(),
      },
    });
    console.log("✅ Step completed");
  }

  // Make next step READY
  const nextStep = workflow.steps.find((s) => s.order === activeStep.order + 1);
  if (nextStep && nextStep.actionState === ActionState.PENDING) {
    await prisma.workflowInstanceStep.update({
      where: { id: nextStep.id },
      data: { actionState: ActionState.READY },
    });
    console.log(`🟢 Step ${nextStep.order} (${nextStep.title}) is now READY\n`);
  } else if (!nextStep) {
    console.log("\n🎉 This was the last step!");
    
    // Update workflow to COMPLETED
    await prisma.workflowInstance.update({
      where: { id: workflow.id },
      data: { status: "COMPLETED" },
    });
    console.log("✅ Workflow marked as COMPLETED\n");
  }

  console.log("✨ Done!\n");
}

main()
  .catch((error) => {
    console.error("\n❌ Error:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
