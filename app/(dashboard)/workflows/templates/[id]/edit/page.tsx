import Link from "next/link";
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
    <div className="min-h-screen bg-gray-50">
      {/* Header with max-width container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-2 lg:px-4 py-8 pb-4">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <ol className="flex items-center space-x-2 text-sm">
            <li>
              <Link
                href="/workflows/templates"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Workflow Templates
              </Link>
            </li>
            <li className="text-gray-400">/</li>
            <li className="text-gray-600 font-semibold">{template.name}</li>
            <li className="text-gray-400">/</li>
            <li className="text-gray-600 font-semibold">Edit</li>
          </ol>
        </nav>

        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Workflow Template</h1>
          <p className="mt-2 text-gray-600">
            Modify template: <span className="font-semibold">{template.name}</span>{" "}
            (Version {template.version})
          </p>
        </div>
      </div>

      {/* Editor - full width */}
      <div className="px-4 sm:px-6 lg:px-8 pb-8">
        <WorkflowTemplateEditor mode="edit" initialDraft={draft} />
      </div>
    </div>
  );
}
