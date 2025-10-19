/**
 * Test script for LEAD workflow creation and execution
 * 
 * This script will:
 * 1. Create a test LEAD contact
 * 2. Start the "Client Intake Process" workflow on it
 * 3. Verify workflow steps are created correctly
 * 4. Test step execution (marking steps as started/completed)
 * 5. Verify the workflow appears in tasks API
 */

import { PrismaClient, ActionType, ActionState, ContactType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting LEAD Workflow Test...\n");

  // Step 1: Find or create a test LEAD contact
  console.log("Step 1: Creating test LEAD contact...");
  
  // Find existing lead or create new one
  let testLead = await prisma.contact.findFirst({
    where: {
      email: "test-lead@example.com",
    },
  });

  if (!testLead) {
    // Get a user to assign as the owner
    const user = await prisma.user.findFirst();
    if (!user) {
      throw new Error("No users found in database. Run seed first.");
    }

    testLead = await prisma.contact.create({
      data: {
        firstName: "Test",
        lastName: "Lead",
        email: "test-lead@example.com",
        phone: "+1-555-0199",
        type: ContactType.LEAD,
        source: "Website Form",
        notes: "Test contact for workflow automation",
        userId: user.id,
      },
    });
  }
  console.log(`✅ Created/Found LEAD: ${testLead.firstName} ${testLead.lastName} (ID: ${testLead.id})\n`);

  // Step 2: Find the "Client Intake Process" workflow template
  console.log("Step 2: Finding Client Intake Process template...");
  const template = await prisma.workflowTemplate.findFirst({
    where: {
      name: "Client Intake Process",
      isActive: true,
    },
    include: {
      steps: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!template) {
    throw new Error("❌ Client Intake Process template not found! Run 'npm run db:seed' first.");
  }
  console.log(`✅ Found template: ${template.name} (v${template.version}) with ${template.steps.length} steps\n`);

  // Step 3: Check if workflow already exists for this contact
  console.log("Step 3: Checking for existing workflows...");
  const existingWorkflow = await prisma.workflowInstance.findFirst({
    where: {
      contactId: testLead.id,
      templateId: template.id,
      status: { in: ["DRAFT", "ACTIVE"] },
    },
  });

  let workflowInstance;
  if (existingWorkflow) {
    console.log(`⚠️  Found existing workflow (ID: ${existingWorkflow.id}). Using it...\n`);
    workflowInstance = existingWorkflow;
  } else {
    // Step 4: Create workflow instance with steps
    console.log("Step 4: Creating workflow instance...");
    
    // Get a user for createdBy
    const user = await prisma.user.findFirst();
    if (!user) {
      throw new Error("No users found in database. Run seed first.");
    }

    workflowInstance = await prisma.workflowInstance.create({
      data: {
        templateId: template.id,
        templateVersion: template.version,
        contactId: testLead.id,
        createdById: user.id,
        status: "ACTIVE",
        steps: {
          create: template.steps.map((step) => ({
            order: step.order,
            title: step.title,
            actionType: step.actionType,
            actionData: step.actionConfig || null,  // Handle null properly
            roleScope: step.roleScope,
            required: step.required,
            // First step is READY, others are PENDING
            actionState: step.order === 0 ? ActionState.READY : ActionState.PENDING,
          })),
        },
      },
      include: {
        steps: {
          orderBy: { order: "asc" },
        },
      },
    });
    console.log(`✅ Created workflow instance (ID: ${workflowInstance.id}) with ${workflowInstance.steps.length} steps\n`);
  }

  // Fetch full workflow with steps
  const fullWorkflow = await prisma.workflowInstance.findUnique({
    where: { id: workflowInstance.id },
    include: {
      steps: {
        orderBy: { order: "asc" },
      },
      template: true,
      contact: true,  // Include contact relation
    },
  });

  if (!fullWorkflow) {
    throw new Error("Failed to fetch workflow");
  }

  // Step 5: Display workflow steps
  console.log("Step 5: Workflow Steps Overview:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  fullWorkflow.steps.forEach((step) => {
    const stateEmoji = {
      PENDING: "⏸️",
      READY: "🟢",
      IN_PROGRESS: "🔄",
      COMPLETED: "✅",
      FAILED: "❌",
      BLOCKED: "🚫",
      SKIPPED: "⏭️",
    }[step.actionState];
    console.log(`${stateEmoji} Step ${step.order}: ${step.title}`);
    console.log(`   Type: ${step.actionType} | Role: ${step.roleScope} | State: ${step.actionState}`);
    if (step.assignedToId) console.log(`   Assigned to: ${step.assignedToId}`);
    console.log();
  });
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Step 6: Verify workflow appears in unified tasks API
  console.log("Step 6: Verifying workflow steps appear in tasks...");
  const tasksFromWorkflow = await prisma.workflowInstanceStep.findMany({
    where: {
      instanceId: workflowInstance.id,  // Correct field name
      actionState: { in: [ActionState.READY, ActionState.IN_PROGRESS] },
    },
    include: {
      instance: {  // Correct relation name
        include: {
          template: true,
          contact: true,
        },
      },
    },
  });
  console.log(`✅ Found ${tasksFromWorkflow.length} active tasks from this workflow\n`);

  // Step 7: Simulate starting the first READY step
  console.log("Step 7: Testing step execution...");
  const firstReadyStep = fullWorkflow.steps.find((s) => s.actionState === ActionState.READY);
  
  if (firstReadyStep) {
    console.log(`🔄 Starting Step ${firstReadyStep.order}: ${firstReadyStep.title}...`);
    
    // Update step to IN_PROGRESS
    await prisma.workflowInstanceStep.update({
      where: { id: firstReadyStep.id },
      data: {
        actionState: ActionState.IN_PROGRESS,
        startedAt: new Date(),
      },
    });
    console.log(`✅ Step marked as IN_PROGRESS\n`);

    // Simulate completion (for CHECKLIST type, we'll mark all items as checked)
    if (firstReadyStep.actionType === ActionType.CHECKLIST) {
      console.log("📋 Simulating checklist completion...");
      const actionData = firstReadyStep.actionData as { items?: string[] };
      const items = actionData?.items || [];
      
      // For checklist, we store array indices of checked items
      await prisma.workflowInstanceStep.update({
        where: { id: firstReadyStep.id },
        data: {
          actionState: ActionState.COMPLETED,
          completedAt: new Date(),
          actionData: {
            ...actionData,
            checkedItems: Array.from({ length: items.length }, (_, i) => i),  // All items checked
          },
        },
      });
      console.log(`✅ Checklist completed with ${items.length} items checked\n`);

      // Make next step READY
      const nextStep = fullWorkflow.steps.find((s) => s.order === firstReadyStep.order + 1);
      if (nextStep && nextStep.actionState === ActionState.PENDING) {
        await prisma.workflowInstanceStep.update({
          where: { id: nextStep.id },
          data: { actionState: ActionState.READY },
        });
        console.log(`🟢 Step ${nextStep.order} (${nextStep.title}) is now READY\n`);
      }
    }
  }

  // Step 8: Final verification
  console.log("Step 8: Final verification...");
  const updatedWorkflow = await prisma.workflowInstance.findUnique({
    where: { id: workflowInstance.id },
    include: {
      steps: {
        orderBy: { order: "asc" },
      },
    },
  });

  const completedSteps = updatedWorkflow?.steps.filter((s) => s.actionState === ActionState.COMPLETED).length || 0;
  const totalSteps = updatedWorkflow?.steps.length || 0;
  const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  console.log("\n📊 Final Status:");
  console.log(`   Contact: ${testLead.firstName} ${testLead.lastName} (${testLead.type})`);
  console.log(`   Workflow: ${template.name}`);
  console.log(`   Progress: ${completedSteps}/${totalSteps} steps (${progress}%)`);
  console.log(`   Status: ${workflowInstance.status}`);
  console.log(`   Contact ID: ${testLead.id}`);
  console.log(`   Workflow ID: ${workflowInstance.id}\n`);

  console.log("✨ Test completed successfully!");
  console.log("\n🔗 Next Steps:");
  console.log(`   1. Open: http://localhost:3000/contacts/${testLead.id}`);
  console.log(`   2. Click the "Workflows" tab`);
  console.log(`   3. Verify the workflow timeline displays correctly`);
  console.log(`   4. Click on a READY step to execute it`);
  console.log(`   5. Check tasks page: http://localhost:3000/tasks`);
}

main()
  .catch((error) => {
    console.error("\n❌ Test failed:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
