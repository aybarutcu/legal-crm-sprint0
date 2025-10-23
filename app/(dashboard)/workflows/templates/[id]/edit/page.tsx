import { notFound } from "next/navigation";
import { WorkflowTemplateEditor } from "@/components/workflows/WorkflowTemplateEditor";
import type { WorkflowTemplateDraft } from "@/components/workflows/WorkflowTemplateEditor";
import { prisma } from "@/lib/prisma";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditWorkflowTemplatePage({ params }: PageProps) {
  const { id } = await params;

  // Fetch template from database
  const template = await prisma.workflowTemplate.findUnique({
    where: { id },
    include: {
      steps: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!template) {
    notFound();
  }

  // Convert to draft format
  const draft: WorkflowTemplateDraft = {
    id: template.id,
    name: template.name,
    description: template.description || "",
    isActive: template.isActive,
    steps: template.steps.map((step) => ({
      id: step.id,
      title: step.title,
      actionType: step.actionType,
      roleScope: step.roleScope,
      required: step.required,
      actionConfig: (step.actionConfig as Record<string, unknown>) || {},
      actionConfigInput: JSON.stringify(step.actionConfig || {}, null, 2),
      order: step.order,
      conditionType: step.conditionType as
        | "ALWAYS"
        | "IF_TRUE"
        | "IF_FALSE"
        | "SWITCH"
        | undefined,
      conditionConfig: (step.conditionConfig as Record<string, unknown>) || null,
      nextStepOnTrue: step.nextStepOnTrue,
      nextStepOnFalse: step.nextStepOnFalse,
      dependsOn: step.dependsOn || [],
      dependencyLogic: step.dependencyLogic as "ALL" | "ANY" | "CUSTOM" | undefined,
      // Canvas position fields (P0.3)
      positionX: step.positionX ?? undefined,
      positionY: step.positionY ?? undefined,
    })),
  };

  return (
    <div className="bg-gray-50">
      {/* Editor - full width with own header */}
      <WorkflowTemplateEditor mode="edit" initialDraft={draft} />
    </div>
  );
}
