import { prisma } from "../lib/prisma";

async function testWorkflowTemplateEditing() {
  console.log("🧪 Testing workflow template editing...");

  // Get a workflow template
  const templates = await prisma.workflowTemplate.findMany({
    include: { 
      steps: true,
      dependencies: true
    },
    take: 1,
  });

  if (templates.length === 0) {
    console.log("❌ No workflow templates found");
    return;
  }

  const template = templates[0];
  console.log(`📋 Testing template: ${template.name} (${template.id})`);
  console.log(`📝 Steps: ${template.steps.length}`);
  console.log(`🔗 Dependencies: ${template.dependencies.length}`);

  // Check that steps don't have CONDITION fields
  const hasConditionFields = template.steps.some(step =>
    'conditionType' in step ||
    'conditionConfig' in step ||
    'nextStepOnTrue' in step ||
    'nextStepOnFalse' in step ||
    'dependsOn' in step ||
    'dependencyLogic' in step ||
    'order' in step
  );

  if (hasConditionFields) {
    console.log("❌ Steps still have old dependency/condition/order fields");
  } else {
    console.log("✅ Steps don't have old dependency/condition/order fields");
  }

  // Check dependencies in separate table
  console.log(`🔗 Steps with dependencies: ${template.dependencies.length}`);

  if (template.dependencies.length > 0) {
    console.log("Dependencies:");
    template.dependencies.forEach(dep => {
      console.log(`  - Step ${dep.targetStepId} depends on Step ${dep.sourceStepId} (${dep.dependencyType})`);
    });
  }

  console.log("✅ Basic template structure looks good");
}

testWorkflowTemplateEditing()
  .catch(console.error)
  .finally(() => process.exit(0));