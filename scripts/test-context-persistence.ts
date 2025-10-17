#!/usr/bin/env tsx
/**
 * Test Workflow Context Persistence
 * 
 * This script tests that workflow handlers automatically populate
 * context values when steps are completed.
 */

import { prisma } from "../lib/prisma";
import { ActionState, Role } from "@prisma/client";
import { completeWorkflowStep, startWorkflowStep } from "../lib/workflows/runtime";
import type { WorkflowInstanceStepWithTemplate } from "../lib/workflows/types";
import "../lib/workflows"; // Register handlers

async function main() {
  console.log("🧪 Testing Workflow Context Persistence\n");
  console.log("=" .repeat(60));

  // Find a workflow instance with steps
  // Get a workflow instance with discovery-style workflow
  let instance = await prisma.workflowInstance.findFirst({
    include: {
      steps: {
        orderBy: { order: "asc" },
        include: {
          templateStep: true,
          instance: true,
        },
      },
      template: true,
    },
  });

  if (!instance || instance.steps.length === 0) {
    console.error("❌ No workflow instance with steps found");
    console.log("\nRun: npx tsx prisma/seed-enhanced.ts");
    return;
  }

  console.log(`\n📋 Template: ${instance.template.name}`);
  console.log(`📦 Instance ID: ${instance.id}`);
  console.log(`📝 Steps: ${instance.steps.length}`);
  console.log("\n" + "=".repeat(60));

  // Check initial context
  console.log("\n📊 Initial Context:");
  console.log(JSON.stringify(instance.contextData || {}, null, 2));

  // Complete steps one by one and check context updates
  for (let i = 0; i < instance.steps.length; i++) {
    let step = instance.steps[i];
    console.log(`\n${"=".repeat(60)}`);
    console.log(`\n🔧 Processing Step ${i + 1}: "${step.title}"`);
    console.log(`   Type: ${step.actionType}`);
    console.log(`   State: ${step.actionState}`);

    try {
      // Skip if already completed
      if (step.actionState === ActionState.COMPLETED) {
        console.log("   ⏭️  Already completed, skipping...");
        continue;
      }

      // Skip if not ready yet
      if (step.actionState === ActionState.PENDING) {
        console.log("   ⏸️  Not ready yet, skipping...");
        continue;
      }

      // Start step if not already started
      if (step.actionState === ActionState.READY) {
        console.log("   ▶️  Starting step...");
        await prisma.$transaction(async (tx) => {
          const freshStep = await tx.workflowInstanceStep.findUnique({
            where: { id: step.id },
            include: {
              templateStep: true,
              instance: true,
            },
          });

          if (!freshStep) {
            throw new Error("Step not found");
          }

          await startWorkflowStep({
            tx,
            instance,
            step: freshStep as WorkflowInstanceStepWithTemplate,
            actor: { id: "admin-1", role: Role.ADMIN },
          });
        });
        console.log("   ✅ Started!");

        // Refetch the instance and step after starting
        instance = (await prisma.workflowInstance.findUnique({
          where: { id: instance.id },
          include: {
            template: true,
            steps: {
              include: { templateStep: true },
              orderBy: { order: "asc" },
            },
          },
        })) as any;

        step = instance.steps.find((s: any) => s.id === step.id);
        if (!step) {
          throw new Error("Step not found after starting");
        }
      }

      // Complete the step with appropriate payload
      console.log("   ✔️  Completing step...");
      const payload = getPayloadForStep(step.actionType);

      await prisma.$transaction(async (tx) => {
        // Fetch fresh step data
        const freshStep = await tx.workflowInstanceStep.findUnique({
          where: { id: step.id },
          include: {
            templateStep: true,
            instance: true,
          },
        });

        if (!freshStep) {
          throw new Error("Step not found");
        }

        await completeWorkflowStep({
          tx,
          instance,
          step: freshStep as WorkflowInstanceStepWithTemplate,
          actor: { id: "admin-1", role: Role.ADMIN },
          payload,
        });

        // Advance workflow to next step
        const steps = await tx.workflowInstanceStep.findMany({
          where: { instanceId: instance.id },
          orderBy: { order: "asc" },
        });

        const firstPending = steps.find((s) => s.actionState === ActionState.PENDING);
        if (firstPending) {
          await tx.workflowInstanceStep.update({
            where: { id: firstPending.id },
            data: { actionState: ActionState.READY },
          });
        }
      });

      console.log("   ✅ Completed!");

      // Fetch updated instance and show context
      const updated = await prisma.workflowInstance.findUnique({
        where: { id: instance.id },
      });

      console.log("\n   📊 Updated Context:");
      console.log(JSON.stringify(updated?.contextData || {}, null, 2).split("\n").map(l => "   " + l).join("\n"));

    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  // Final summary
  console.log(`\n${"=".repeat(60)}`);
  console.log("\n📊 Final Workflow Context:\n");
  
  const final = await prisma.workflowInstance.findUnique({
    where: { id: instance.id },
  });

  const context = final?.contextData as Record<string, unknown> || {};
  console.log(JSON.stringify(context, null, 2));

  console.log(`\n${"=".repeat(60)}`);
  console.log("\n📈 Context Summary:");
  console.log(`   Total keys: ${Object.keys(context).length}`);
  console.log(`   Keys: ${Object.keys(context).join(", ")}`);

  // Check against schema
  if (instance.template.contextSchema) {
    const schema = instance.template.contextSchema as any;
    const expectedFields = Object.keys(schema.fields || {});
    const populatedFields = Object.keys(context);

    console.log(`\n📋 Schema Compliance:`);
    console.log(`   Expected fields: ${expectedFields.length}`);
    console.log(`   Populated fields: ${populatedFields.length}`);

    const missing = expectedFields.filter(f => !populatedFields.includes(f));
    if (missing.length > 0) {
      console.log(`   ⚠️  Missing fields: ${missing.join(", ")}`);
    } else {
      console.log(`   ✅ All schema fields populated!`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("\n✨ Context persistence test complete!\n");
}

function getPayloadForStep(actionType: string): unknown {
  switch (actionType) {
    case "APPROVAL_LAWYER":
      return {
        approved: true,
        comment: "Approved via test script",
      };
    case "SIGNATURE_CLIENT":
      return {
        signedAt: new Date().toISOString(),
      };
    case "REQUEST_DOC_CLIENT":
      return {
        documentId: "test-doc-123",
      };
    case "PAYMENT_CLIENT":
      return {
        paidAt: new Date().toISOString(),
      };
    case "CHECKLIST":
      return {
        completedItems: ["Item 1", "Item 2"],
      };
    default:
      return {};
  }
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
