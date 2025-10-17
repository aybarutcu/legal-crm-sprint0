#!/usr/bin/env tsx

/**
 * Script to test Workflow Context UI
 * 
 * This script:
 * 1. Finds an existing workflow instance
 * 2. Sets some sample context data
 * 3. Displays the result
 * 
 * Run: npx tsx scripts/test-context-ui.ts
 */

import { PrismaClient } from "@prisma/client";
import {
  updateWorkflowContext,
  getWorkflowContext,
} from "../lib/workflows/context";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Testing Workflow Context UI...\n");

  // Find first workflow instance
  const instance = await prisma.workflowInstance.findFirst({
    include: {
      template: true,
      matter: true,
    },
  });

  if (!instance) {
    console.log("❌ No workflow instances found. Please create one first.");
    console.log("   1. Go to http://localhost:3000/matters");
    console.log("   2. Open a matter");
    console.log("   3. Click 'Add Workflow' and instantiate a template");
    return;
  }

  console.log(`✅ Found workflow instance: ${instance.template.name}`);
  console.log(`   Matter: ${instance.matter.title}`);
  console.log(`   Instance ID: ${instance.id}\n`);

  // Set sample context data
  console.log("📝 Setting sample context data...");
  
  const sampleContext = {
    clientApproved: true,
    documentCount: 3,
    approverName: "John Doe",
    documents: ["contract.pdf", "addendum.pdf", "signature.pdf"],
    paymentDetails: {
      amount: 5000,
      currency: "USD",
      status: "pending",
    },
    completedSteps: 2,
    notes: "Client requested expedited processing",
  };

  await updateWorkflowContext(instance.id, sampleContext);

  console.log("✅ Context data set successfully!\n");

  // Retrieve and display context
  const context = await getWorkflowContext(instance.id);

  console.log("📊 Current context data:");
  console.log(JSON.stringify(context, null, 2));

  console.log("\n✨ Done! Now test the UI:");
  console.log(`   1. Go to http://localhost:3000/matters/${instance.matterId}`);
  console.log(`   2. Find the workflow section`);
  console.log(`   3. Expand "Workflow Context" panel`);
  console.log(`   4. You should see all the context values!`);
  console.log(`   5. Try editing, adding, and deleting values`);
  console.log(`   6. Test the "Export" and "Clear All" buttons\n`);
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
