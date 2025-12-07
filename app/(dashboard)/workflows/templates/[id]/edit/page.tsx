import { notFound } from "next/navigation";
import { WorkflowTemplateEditor } from "@/components/workflows/WorkflowTemplateEditor";
import type { WorkflowTemplateDraft } from "@/components/workflows/WorkflowTemplateEditor";
import { prisma } from "@/lib/prisma";
import type { NotificationPolicy } from "@/lib/workflows/notification-policy";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditWorkflowTemplatePage({ params }: PageProps) {
  const { id } = await params;

  // Fetch template from database
  const template = await prisma.workflowTemplate.findUnique({
    where: { id },
    include: {
      steps: true,
      dependencies: true,
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
      positionX: step.positionX ?? undefined,
      positionY: step.positionY ?? undefined,
      notificationPolicies: (step.notificationPolicies as unknown as NotificationPolicy[]) || [],
    })),
    dependencies: template.dependencies.map((dep) => ({
      id: dep.id,
      sourceStepId: dep.sourceStepId,
      targetStepId: dep.targetStepId,
      dependencyType: dep.dependencyType,
      dependencyLogic: dep.dependencyLogic,
      conditionType: dep.conditionType || undefined,
      conditionConfig: dep.conditionConfig as Record<string, unknown> | undefined,
    })),
  };

  return (
    <div className="bg-gray-50">
      {/* Editor - full width with own header */}
      <WorkflowTemplateEditor mode="edit" initialDraft={draft} />
    </div>
  );
}
