import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkForSpecificDependency() {
  const targetId = "0019673e-b53a-4da8-90d5-0b28d19f4556";

  // Check workflow template dependencies
  const templateDependencies = await prisma.workflowTemplateDependency.findMany({
    where: {
      sourceStepId: targetId,
    },
    include: {
      template: true,
      targetStep: true,
    },
  });

  if (templateDependencies.length > 0) {
    console.log("Found in template dependencies:");
    templateDependencies.forEach(dep => {
      console.log(`Template: ${dep.template?.name}, Source Step: ${dep.sourceStepId}, Target Step: ${dep.targetStep?.title}`);
    });
  }

    // Check workflow instance dependencies
  const instanceDependencies = await prisma.workflowInstanceDependency.findMany({
    where: {
      sourceStepId: targetId,
    },
    include: {
      instance: {
        include: {
          template: true,
        },
      },
      targetStep: true,
    },
  });

  if (instanceDependencies.length > 0) {
    console.log("Found in instance dependencies:");
    instanceDependencies.forEach(dep => {
      console.log(`Instance: ${dep.instance?.id}, Template: ${dep.instance?.template?.name}, Source Step: ${dep.sourceStepId}, Target Step: ${dep.targetStep?.title}`);
    });
  }

  // Check if the target step exists
  const targetStep = await prisma.workflowTemplateStep.findUnique({
    where: { id: targetId },
  });

  if (targetStep) {
    console.log(`Target step exists: ${targetStep.title} in template ${targetStep.templateId}`);
  } else {
    console.log("Target step does not exist - this is an orphaned dependency!");
  }

  await prisma.$disconnect();
}

checkForSpecificDependency().catch(console.error);