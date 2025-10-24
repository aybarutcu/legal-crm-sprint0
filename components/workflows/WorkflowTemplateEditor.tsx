"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { WorkflowCanvas } from "@/components/workflows/WorkflowCanvas";
import type { WorkflowStep as CanvasWorkflowStep } from "@/components/workflows/WorkflowCanvas";
import { ArrowLeft, Save, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";

export type WorkflowStep = {
  id?: string;
  title: string;
  actionType: string;
  roleScope: string;
  required: boolean;
  actionConfig: Record<string, unknown>;
  actionConfigInput?: string;
  order: number;
  conditionType?: "ALWAYS" | "IF_TRUE" | "IF_FALSE" | "SWITCH";
  conditionConfig?: Record<string, unknown> | null;
  nextStepOnTrue?: number | null;
  nextStepOnFalse?: number | null;
  dependsOn?: number[];
  dependencyLogic?: "ALL" | "ANY" | "CUSTOM";
  positionX?: number;
  positionY?: number;
};

export type WorkflowTemplateDraft = {
  id?: string;
  isActive?: boolean;
  name: string;
  description: string;
  steps: WorkflowStep[];
};

function normaliseSteps(steps: WorkflowStep[]): WorkflowStep[] {
  return steps.map((step, index) => ({
    ...step,
    order: index,
  }));
}

interface WorkflowTemplateEditorProps {
  initialDraft?: WorkflowTemplateDraft;
  mode: "create" | "edit";
  onCancel?: () => void;
}

export function WorkflowTemplateEditor({ initialDraft, mode, onCancel }: WorkflowTemplateEditorProps) {
  const router = useRouter();
  
  const emptyDraft: WorkflowTemplateDraft = {
    name: "",
    description: "",
    steps: [
      {
        title: "New Task",
        actionType: "TASK",
        roleScope: "ADMIN",
        required: true,
        actionConfig: { description: "", requiresEvidence: false },
        actionConfigInput: JSON.stringify({ description: "", requiresEvidence: false }, null, 2),
        order: 0,
        conditionType: "ALWAYS",
        conditionConfig: null,
        nextStepOnTrue: null,
        nextStepOnFalse: null,
      },
    ],
  };

  const [draft, setDraft] = useState<WorkflowTemplateDraft>(initialDraft || emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBuilderHelp, setShowBuilderHelp] = useState(false);

  // Memoize canvas steps to prevent infinite re-renders
  const canvasSteps = useMemo(() => 
    draft.steps.map((step, idx) => ({
      id: step.id,
      order: step.order ?? idx,
      title: step.title || `Step ${idx + 1}`,
      actionType: step.actionType as CanvasWorkflowStep["actionType"],
      roleScope: step.roleScope as CanvasWorkflowStep["roleScope"],
      required: step.required ?? true,
      actionConfig: step.actionConfig,
      dependsOn: step.dependsOn,
      dependencyLogic: step.dependencyLogic,
      conditionType: step.conditionType,
      conditionConfig: step.conditionConfig,
      positionX: step.positionX,
      positionY: step.positionY,
      nextStepOnTrue: step.nextStepOnTrue ?? null,
      nextStepOnFalse: step.nextStepOnFalse ?? null,
    } as CanvasWorkflowStep))
  , [draft.steps]);

  // Memoize onChange handler to prevent unnecessary re-renders
  const handleCanvasChange = useCallback((updatedSteps: CanvasWorkflowStep[]) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      steps: normaliseSteps(
        updatedSteps.map((canvasStep) => ({
          ...canvasStep,
          required: canvasStep.required ?? true,
          actionConfig:
            (Array.isArray(canvasStep.actionConfig)
              ? {}
              : canvasStep.actionConfig) ?? {},
          actionConfigInput: JSON.stringify(
            canvasStep.actionConfig ?? {},
            null,
            2
          ),
          conditionType: (canvasStep.conditionType as "ALWAYS" | "IF_TRUE" | "IF_FALSE" | "SWITCH" | undefined) || "ALWAYS",
          conditionConfig: (canvasStep.conditionConfig as Record<string, unknown> | null) || null,
          positionX: canvasStep.positionX,
          positionY: canvasStep.positionY,
          nextStepOnTrue: canvasStep.nextStepOnTrue ?? null,
          nextStepOnFalse: canvasStep.nextStepOnFalse ?? null,
        }))
      ),
    }));
  }, []);

  async function saveTemplate() {
    if (!draft.name.trim()) {
      setError("Template name is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        name: draft.name,
        description: draft.description || "",
        isActive: draft.isActive ?? false,
        steps: draft.steps.map((step) => ({
          title: step.title,
          actionType: step.actionType,
          roleScope: step.roleScope,
          required: step.required,
          actionConfig: step.actionConfig,
          order: step.order,
          conditionType: step.conditionType,
          conditionConfig: step.conditionConfig,
          nextStepOnTrue: step.nextStepOnTrue,
          nextStepOnFalse: step.nextStepOnFalse,
          dependsOn: step.dependsOn,
          dependencyLogic: step.dependencyLogic,
          positionX: step.positionX,
          positionY: step.positionY,
        })),
      };

      const url =
        mode === "edit" && draft.id
          ? `/api/workflows/templates/${draft.id}`
          : "/api/workflows/templates";
      const method = mode === "edit" ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Failed to save template (${response.status})`);
      }

      // Navigate back to templates list
      router.push("/workflows/templates");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (onCancel) {
      onCancel();
    } else {
      router.push("/workflows/templates");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/workflows/templates"
                className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="font-medium">Back</span>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {mode === "edit" ? "Edit" : "Create"} Workflow Template
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  {mode === "edit" ? `Template: ${draft.name || "Untitled"}` : "Build a new workflow template"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="px-5 py-2.5 text-gray-700 bg-white border-2 border-gray-300 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveTemplate}
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : mode === "edit" ? "Update Template" : "Create Template"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="rounded-lg bg-red-50 border-2 border-red-200 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Template Info */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="space-y-4 bg-white rounded-lg border-2 border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 border-b pb-3">Template Information</h3>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Template Name *
            </label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Client Onboarding Process"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Describe what this workflow template does..."
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.isActive ?? false}
                onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Active (ready to use)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Canvas Editor */}
      <div className="max-w-7xl mx-auto px-6 pb-6">
        <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-bold text-gray-900">Visual Workflow Builder</h2>
            <p className="text-sm text-gray-600 mt-1">
              Use the canvas below to design your workflow template
            </p>
          </div>
          
          <div className="bg-blue-50 border-b-2 border-blue-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowBuilderHelp(!showBuilderHelp)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-blue-100 transition-colors"
            >
              <p className="font-semibold text-sm text-blue-800">🎨 Visual Workflow Builder Tips</p>
              {showBuilderHelp ? (
                <ChevronDown className="h-4 w-4 text-blue-800" />
              ) : (
                <ChevronRight className="h-4 w-4 text-blue-800" />
              )}
            </button>
            {showBuilderHelp && (
              <div className="px-4 pb-4">
                <ul className="text-sm text-blue-800 space-y-1 ml-4 list-disc">
                  <li>Click action types in the palette to add steps</li>
                  <li>Click and drag from the green dot to create dependencies</li>
                  <li><strong>Click a node to edit its properties and configuration</strong></li>
                  <li>Delete connections by selecting an edge and pressing Delete</li>
                </ul>
              </div>
            )}
          </div>

          <div className="h-[600px]">
            <WorkflowCanvas
              steps={canvasSteps}
              onChange={handleCanvasChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
