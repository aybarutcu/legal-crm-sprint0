import Link from "next/link";
import { WorkflowTemplateEditor } from "@/components/workflows/WorkflowTemplateEditor";
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
          actionType: step.actionType,
          roleScope: step.roleScope,
          required: step.required,
          actionConfig: (step.actionConfig as Record<string, unknown>) || {},
          order: step.order,
          dependsOn: step.dependsOn,
          dependencyLogic: step.dependencyLogic,
          conditionType: step.conditionType,
          conditionConfig: step.conditionConfig as Record<string, unknown> | null,
        })),
      };
    }
  }

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
            <li className="text-gray-600 font-semibold">New Template</li>
          </ol>
        </nav>

        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {sourceId ? "Create New Version" : "Create Workflow Template"}
          </h1>
          <p className="mt-2 text-gray-600">
            {sourceId
              ? "Creating a new version based on an existing template"
              : "Design a reusable workflow template with visual canvas or form editor"}
          </p>
        </div>
      </div>

      {/* Editor - full width */}
      <div className="px-4 sm:px-6 lg:px-8 pb-8">
        <WorkflowTemplateEditor mode="create" initialDraft={initialDraft || undefined} />
      </div>
    </div>
  );
}
