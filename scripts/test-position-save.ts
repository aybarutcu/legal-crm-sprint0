/**
 * Test script to verify position fields are being saved and loaded
 * Run with: npx tsx scripts/test-position-save.ts
 */

import { prisma } from "../lib/prisma";

async function testPositionPersistence() {
  console.log("🧪 Testing position persistence...\n");

  try {
    // Find an admin user
    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
    });

    if (!admin) {
      console.error("❌ No admin user found");
      return;
    }

    console.log(`✅ Found admin: ${admin.email}\n`);

    // Create a test template with explicit positions
    const template = await prisma.workflowTemplate.create({
      data: {
        name: `Position Test ${Date.now()}`,
        description: "Testing position persistence",
        createdById: admin.id,
        version: 1,
        steps: {
          create: [
            {
              title: "Step 1",
              actionType: "TASK",
              roleScope: "LAWYER",
              required: true,
              actionConfig: { description: "Test task 1" },
              positionX: 100,
              positionY: 200,
            },
            {
              title: "Step 2",
              actionType: "TASK",
              roleScope: "LAWYER",
              required: true,
              actionConfig: { description: "Test task 2" },
              positionX: 450.5,
              positionY: 300.75,
            },
          ],
        },
      },
      include: {
        steps: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    console.log("✅ Created test template:\n");
    console.log(`   ID: ${template.id}`);
    console.log(`   Name: ${template.name}\n`);

    console.log("📊 Steps created:");
    template.steps.forEach((step) => {
      console.log(`   - ${step.title}`);
      console.log(`     positionX: ${step.positionX}`);
      console.log(`     positionY: ${step.positionY}\n`);
    });

    // Now fetch it again to verify it was persisted
    const fetched = await prisma.workflowTemplate.findUnique({
      where: { id: template.id },
      include: {
        steps: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    console.log("🔍 Fetched template from database:\n");
    console.log("📊 Steps retrieved:");
    fetched?.steps.forEach((step) => {
      console.log(`   - ${step.title}`);
      console.log(`     positionX: ${step.positionX}`);
      console.log(`     positionY: ${step.positionY}\n`);
    });

    // Verify positions match
    const step1 = fetched?.steps[0];
    const step2 = fetched?.steps[1];

    if (step1?.positionX === 100 && step1?.positionY === 200) {
      console.log("✅ Step 1 positions match!");
    } else {
      console.log(`❌ Step 1 positions mismatch: ${step1?.positionX}, ${step1?.positionY}`);
    }

    if (step2?.positionX === 450.5 && step2?.positionY === 300.75) {
      console.log("✅ Step 2 positions match!");
    } else {
      console.log(`❌ Step 2 positions mismatch: ${step2?.positionX}, ${step2?.positionY}`);
    }

    // Clean up
    await prisma.workflowTemplate.delete({
      where: { id: template.id },
    });

    console.log("\n🧹 Cleaned up test template");
    console.log("\n✅ Test complete!");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testPositionPersistence();
