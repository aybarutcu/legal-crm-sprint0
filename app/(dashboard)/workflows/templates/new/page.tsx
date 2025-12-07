import { WorkflowTemplateEditor } from "@/components/workflows/WorkflowTemplateEditor";
import type { WorkflowTemplateDraft } from "@/components/workflows/WorkflowTemplateEditor";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

// Server-compatible ID generation
function generateStepId(): string {
  try {
    return randomUUID();
  } catch {
    return `step_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export default async function NewWorkflowTemplatePage({
  searchParams,
}: {
  searchParams: Promise<{ sourceId?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const sourceId = params.sourceId;
  const mode = params.mode; // 'version' or 'duplicate'

  // If sourceId is provided, fetch the template to create a new version
  let initialDraft: WorkflowTemplateDraft | undefined = undefined;
  
  if (sourceId) {
    const sourceTemplate = await prisma.workflowTemplate.findUnique({
      where: { id: sourceId },
      include: { 
        steps: true,
        dependencies: true,
      },
    });

    if (sourceTemplate) {
      // Create a mapping from old step IDs to new step IDs
      const idMapping = new Map<string, string>();
      sourceTemplate.steps.forEach((step) => {
        idMapping.set(step.id, generateStepId());
      });

      // For new version: keep the same name (version will auto-increment)
      // For duplicate: add (Copy) to create a new template
      const templateName = mode === 'version' 
        ? sourceTemplate.name 
        : `${sourceTemplate.name} (Copy)`;

      initialDraft = {
        name: templateName,
        description: sourceTemplate.description || "",
        steps: sourceTemplate.steps.map((step) => {
          const newId = idMapping.get(step.id)!;
          return {
            id: newId,
            title: step.title,
            actionType: step.actionType as string,
            roleScope: step.roleScope as string,
            required: step.required,
            actionConfig: (step.actionConfig as Record<string, unknown>) || {},
            actionConfigInput: JSON.stringify((step.actionConfig as Record<string, unknown>) || {}, null, 2),
            positionX: step.positionX ?? undefined,
            positionY: step.positionY ?? undefined,
            notificationPolicies: [],
          };
        }),
        dependencies: sourceTemplate.dependencies.map((dep) => ({
          id: `dep_${generateStepId()}`,
          sourceStepId: idMapping.get(dep.sourceStepId)!,
          targetStepId: idMapping.get(dep.targetStepId)!,
          dependencyType: dep.dependencyType,
          dependencyLogic: dep.dependencyLogic,
          conditionType: dep.conditionType || undefined,
          conditionConfig: dep.conditionConfig as Record<string, unknown> | undefined,
        })),
      };
    }
  }

  return (
    <div className="bg-gray-50">
      {/* Editor - full width with own header */}
      <WorkflowTemplateEditor 
        mode="create" 
        initialDraft={initialDraft as WorkflowTemplateDraft | undefined}
        versioningMode={mode as 'version' | 'duplicate' | undefined}
      />
    </div>
  );
}
