#!/usr/bin/env tsx
/**
 * Test Context Schema Validation
 * 
 * This script tests the schema validation by attempting to add
 * valid and invalid context values to a workflow instance.
 */

import { prisma } from "../lib/prisma";
import { validateContextField } from "../lib/workflows/context-schema";
import type { ContextFieldDefinition } from "../lib/workflows/context-schema";

async function main() {
  console.log("🧪 Testing Context Schema Validation\n");
  console.log("=" .repeat(60));

  // Find a workflow instance with a schema
  const instance = await prisma.workflowInstance.findFirst({
    include: {
      template: {
        select: {
          name: true,
          contextSchema: true,
        },
      },
    },
  });

  if (!instance) {
    console.error("❌ No workflow instance found");
    return;
  }

  if (!instance.template.contextSchema) {
    console.error("❌ Workflow template has no context schema");
    return;
  }

  const schema = instance.template.contextSchema as any;
  console.log(`\n📋 Template: ${instance.template.name}`);
  console.log(`📦 Instance ID: ${instance.id}`);
  console.log(`\n🔍 Schema Fields:`);
  console.log(JSON.stringify(schema.fields, null, 2));
  console.log("\n" + "=".repeat(60));

  // Test cases
  const testCases = [
    {
      name: "✅ Valid boolean (required)",
      field: "clientApproved",
      value: true,
      shouldPass: true,
    },
    {
      name: "❌ Missing required boolean",
      field: "clientApproved",
      value: null,
      shouldPass: false,
    },
    {
      name: "✅ Valid number within range",
      field: "documentCount",
      value: 25,
      shouldPass: true,
    },
    {
      name: "❌ Number below minimum",
      field: "documentCount",
      value: -5,
      shouldPass: false,
    },
    {
      name: "❌ Number above maximum",
      field: "documentCount",
      value: 5000,
      shouldPass: false,
    },
    {
      name: "✅ Valid string (optional)",
      field: "approverName",
      value: "John Doe",
      shouldPass: true,
    },
    {
      name: "❌ String too short",
      field: "approverName",
      value: "J",
      shouldPass: false,
    },
    {
      name: "❌ String too long",
      field: "approverName",
      value: "A".repeat(150),
      shouldPass: false,
    },
    {
      name: "✅ Valid date pattern",
      field: "discoveryDeadline",
      value: "2024-12-31",
      shouldPass: true,
    },
    {
      name: "❌ Invalid date pattern",
      field: "discoveryDeadline",
      value: "12/31/2024",
      shouldPass: false,
    },
    {
      name: "✅ Valid array",
      field: "requestedDocuments",
      value: ["Contract", "Invoice", "Receipt"],
      shouldPass: true,
    },
    {
      name: "❌ Array too few items",
      field: "requestedDocuments",
      value: [],
      shouldPass: false,
    },
    {
      name: "❌ Array too many items",
      field: "requestedDocuments",
      value: Array(60).fill("Document"),
      shouldPass: false,
    },
  ];

  console.log("\n🧪 Running Validation Tests:\n");

  let passed = 0;
  let failed = 0;

  for (const test of testCases) {
    const fieldDef = schema.fields[test.field] as ContextFieldDefinition;
    if (!fieldDef) {
      console.log(`⚠️  Field '${test.field}' not found in schema`);
      continue;
    }

    const errors = validateContextField(test.field, test.value, fieldDef);
    const isValid = errors.length === 0;
    const result = isValid === test.shouldPass ? "✅ PASS" : "❌ FAIL";

    if (isValid === test.shouldPass) {
      passed++;
    } else {
      failed++;
    }

    console.log(`${result} - ${test.name}`);
    if (errors.length > 0) {
      errors.forEach((err) => {
        console.log(`     └─ ${err.message} (${err.code})`);
      });
    }
    console.log();
  }

  console.log("=".repeat(60));
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log("\n🎉 All tests passed!");
  } else {
    console.log("\n⚠️  Some tests failed!");
  }

  // Now let's update the instance with valid values
  console.log("\n" + "=".repeat(60));
  console.log("\n💾 Updating instance with valid context values...\n");

  const validContext = {
    clientApproved: true,
    documentCount: 42,
    approverName: "Jane Smith",
    discoveryDeadline: "2024-12-31",
    requestedDocuments: ["Contract", "Invoice", "Financial Records"],
  };

  await prisma.workflowInstance.update({
    where: { id: instance.id },
    data: { contextData: validContext },
  });

  console.log("✅ Context updated successfully!");
  console.log("\nContext data:");
  console.log(JSON.stringify(validContext, null, 2));
  
  console.log("\n" + "=".repeat(60));
  console.log("\n✨ Schema validation test complete!\n");
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
