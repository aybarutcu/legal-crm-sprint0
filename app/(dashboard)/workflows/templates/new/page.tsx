import { WorkflowTemplateEditor } from "@/components/workflows/WorkflowTemplateEditor";
import type { WorkflowTemplateDraft } from "@/components/workflows/WorkflowTemplateEditor";
import { prisma } from "@/lib/prisma";

export default async function NewWorkflowTemplatePage({
  searchParams,
}: {
  searchParams: Promise<{ sourceId?: string }>;
}) {
  const params = await searchParams;
  const sourceId = params.sourceId;

  // If sourceId is provided, fetch the template to create a new version
  let initialDraft: {
    name: string;
    description: string;
    steps: Array<{
      title: string;
      actionType: string;
      roleScope: string;
      required: boolean;
      actionConfig: Record<string, unknown>;
      order: number;
      dependsOn?: number[];
      dependencyLogic?: string;
      conditionType?: string;
      conditionConfig?: Record<string, unknown> | null;
    }>;
  } | undefined = undefined;
  
  if (sourceId) {
    const sourceTemplate = await prisma.workflowTemplate.findUnique({
      where: { id: sourceId },
      include: { steps: { orderBy: { order: "asc" } } },
    });

    if (sourceTemplate) {
      initialDraft = {
        name: sourceTemplate.name,
        description: sourceTemplate.description || "",
        steps: sourceTemplate.steps.map((step) => ({
          title: step.title,
          actionType: step.actionType as string,
          roleScope: step.roleScope as string,
          required: step.required,
          actionConfig: (step.actionConfig as Record<string, unknown>) || {},
          actionConfigInput: JSON.stringify((step.actionConfig as Record<string, unknown>) || {}, null, 2),
          order: step.order,
          dependsOn: step.dependsOn || undefined,
          dependencyLogic: (step.dependencyLogic as "ALL" | "ANY" | "CUSTOM" | undefined) || undefined,
          conditionType: (step.conditionType as "ALWAYS" | "IF_TRUE" | "IF_FALSE" | "SWITCH" | undefined) || undefined,
          conditionConfig: (step.conditionConfig as Record<string, unknown> | null) || null,
          nextStepOnTrue: step.nextStepOnTrue || null,
          nextStepOnFalse: step.nextStepOnFalse || null,
          positionX: step.positionX ?? undefined,
          positionY: step.positionY ?? undefined,
        })),
      };
    }
  }

  return (
    <div className="bg-gray-50">
      {/* Editor - full width with own header */}
      <WorkflowTemplateEditor mode="create" initialDraft={initialDraft as WorkflowTemplateDraft | undefined} />
    </div>
  );
}
