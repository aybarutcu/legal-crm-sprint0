"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { WorkflowCanvas } from "@/components/workflows/WorkflowCanvas";
import type { WorkflowStep as CanvasWorkflowStep } from "@/components/workflows/WorkflowCanvas";
import { ArrowLeft, Save, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { createStepId } from "@/components/workflows/create-step-id";
import type { NotificationPolicy } from "@/lib/workflows/notification-policy";

export type WorkflowStep = {
  id: string;
  title: string;
  actionType: string;
  roleScope: string;
  required: boolean;
  actionConfig: Record<string, unknown>;
  actionConfigInput?: string;
  positionX?: number;
  positionY?: number;
  notificationPolicies?: NotificationPolicy[];
};

export type WorkflowDependency = {
  id: string;
  sourceStepId: string;
  targetStepId: string;
  dependencyType: "DEPENDS_ON" | "TRIGGERS" | "IF_TRUE_BRANCH" | "IF_FALSE_BRANCH";
  dependencyLogic: "ALL" | "ANY" | "CUSTOM";
  conditionType?: "ALWAYS" | "IF_TRUE" | "IF_FALSE" | "SWITCH";
  conditionConfig?: Record<string, unknown>;
};

export type WorkflowTemplateDraft = {
  id?: string;
  isActive?: boolean;
  name: string;
  description: string;
  steps: WorkflowStep[];
  dependencies: WorkflowDependency[];
};

function ensureStepId(step: WorkflowStep): WorkflowStep {
  if (step.id) {
    return step;
  }
  return { ...step, id: createStepId() };
}

function normaliseSteps(steps: WorkflowStep[]): WorkflowStep[] {
  return steps.map((step) => ({
    ...ensureStepId(step),
  }));
}

interface WorkflowTemplateEditorProps {
  initialDraft?: WorkflowTemplateDraft;
  mode: "create" | "edit";
  versioningMode?: "version" | "duplicate"; // 'version' = creating new version (lock name), 'duplicate' = duplicating template
  onCancel?: () => void;
}

export function WorkflowTemplateEditor({ initialDraft, mode, versioningMode, onCancel }: WorkflowTemplateEditorProps) {
  const router = useRouter();
  
  const emptyDraft: WorkflowTemplateDraft = {
    name: "",
    description: "",
    steps: [
      {
        id: createStepId(),
        title: "New Task",
        actionType: "TASK",
        roleScope: "ADMIN",
        required: true,
        actionConfig: { description: "", requiresEvidence: false },
        actionConfigInput: JSON.stringify({ description: "", requiresEvidence: false }, null, 2),
        notificationPolicies: [],
      },
    ],
    dependencies: [],
  };

  const [draft, setDraft] = useState<WorkflowTemplateDraft>(() => {
    if (initialDraft) {
      return {
        ...initialDraft,
        steps: normaliseSteps(initialDraft.steps),
        dependencies: initialDraft.dependencies ?? [],
      };
    }
    return emptyDraft;
  });
  
  // Store initial draft for change detection
  const [initialDraftSnapshot] = useState<WorkflowTemplateDraft>(() => {
    if (initialDraft) {
      return {
        ...initialDraft,
        steps: normaliseSteps(initialDraft.steps),
        dependencies: initialDraft.dependencies ?? [],
      };
    }
    return emptyDraft;
  });
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBuilderHelp, setShowBuilderHelp] = useState(false);
  const [showNameChangeWarning, setShowNameChangeWarning] = useState(false);
  const [pendingNameChange, setPendingNameChange] = useState<string | null>(null);

  // Memoize canvas steps to prevent infinite re-renders
  const canvasSteps = useMemo(() =>
    draft.steps.map((step, idx) => ({
      id: ensureStepId(step).id,
      title: step.title || `Step ${idx + 1}`,
      actionType: step.actionType as CanvasWorkflowStep["actionType"],
      roleScope: step.roleScope as CanvasWorkflowStep["roleScope"],
      required: step.required ?? true,
      actionConfig: step.actionConfig,
      positionX: step.positionX,
      positionY: step.positionY,
      notificationPolicies: step.notificationPolicies ?? [],
    } as CanvasWorkflowStep))
  , [draft.steps]);

  // Memoize props for WorkflowCanvas to prevent unnecessary re-renders
  const canvasProps = useMemo(() => ({
    steps: canvasSteps,
    dependencies: draft.dependencies,
  }), [canvasSteps, draft.dependencies]);
  const currentValidationErrors = useMemo(() => {
    // Temporarily disable validation to test if it's causing infinite loops
    return [];
  }, []);

  const handleCanvasChange = useCallback((updatedSteps: CanvasWorkflowStep[], updatedDependencies?: WorkflowDependency[]) => {
    setDraft((currentDraft) => {
      const newSteps = normaliseSteps(
        updatedSteps.map((canvasStep) => ({
          ...canvasStep,
          id: canvasStep.id ?? createStepId(),
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
          positionX: canvasStep.positionX,
          positionY: canvasStep.positionY,
          notificationPolicies: canvasStep.notificationPolicies ?? [],
        }))
      );

      const newDependencies = updatedDependencies ?? currentDraft.dependencies;

      // Only update if something actually changed
      if (
        newSteps.length !== currentDraft.steps.length ||
        newSteps.some((step, idx) => step.id !== currentDraft.steps[idx]?.id) ||
        JSON.stringify(newSteps) !== JSON.stringify(currentDraft.steps) ||
        JSON.stringify(newDependencies) !== JSON.stringify(currentDraft.dependencies)
      ) {
        return {
          ...currentDraft,
          steps: newSteps,
          dependencies: newDependencies,
        };
      }

      return currentDraft;
    });
  }, []);

  // Helper function to clean up orphaned dependencies
  function cleanupOrphanedDependencies(steps: WorkflowStep[], dependencies: WorkflowDependency[]): WorkflowDependency[] {
    const stepIds = new Set(steps.map(step => step.id));
    
    return dependencies.filter(dep => 
      stepIds.has(dep.sourceStepId) && stepIds.has(dep.targetStepId)
    );
  }

  // Helper function to check if draft has changed
  function hasChanges(): boolean {
    // Compare name and description
    if (draft.name !== initialDraftSnapshot.name) return true;
    if (draft.description !== initialDraftSnapshot.description) return true;
    if ((draft.isActive ?? false) !== (initialDraftSnapshot.isActive ?? false)) return true;

    // Compare steps (deep comparison)
    if (draft.steps.length !== initialDraftSnapshot.steps.length) return true;
    
    const stepsChanged = draft.steps.some((step, idx) => {
      const initialStep = initialDraftSnapshot.steps[idx];
      if (!initialStep) return true;
      
      return (
        step.title !== initialStep.title ||
        step.actionType !== initialStep.actionType ||
        step.roleScope !== initialStep.roleScope ||
        step.required !== initialStep.required ||
        JSON.stringify(step.actionConfig) !== JSON.stringify(initialStep.actionConfig) ||
        step.positionX !== initialStep.positionX ||
        step.positionY !== initialStep.positionY
      );
    });
    
    if (stepsChanged) return true;

    // Compare dependencies
    if (draft.dependencies.length !== initialDraftSnapshot.dependencies.length) return true;
    
    const depsChanged = JSON.stringify(draft.dependencies) !== JSON.stringify(initialDraftSnapshot.dependencies);
    
    return depsChanged;
  }

  async function saveTemplate() {
    if (!draft.name.trim()) {
      setError("Template name is required");
      return;
    }

    // Check if anything changed (only for edit mode or when creating from source)
    if (initialDraft && !hasChanges()) {
      setError("No changes detected. Please modify the template before saving.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Clean up orphaned dependencies before saving
      const cleanedDependencies = cleanupOrphanedDependencies(draft.steps, draft.dependencies);

      const payload = {
        name: draft.name,
        description: draft.description || "",
        isActive: draft.isActive ?? false,
        steps: draft.steps.map((step) => ({
          id: step.id,
          title: step.title,
          actionType: step.actionType,
          roleScope: step.roleScope,
          required: step.required,
          actionConfig: step.actionConfig,
          positionX: step.positionX,
          positionY: step.positionY,
          notificationPolicies: step.notificationPolicies ?? [],
        })),
        dependencies: cleanedDependencies,
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

  // Handle name change with warning for version mode
  function handleNameChange(newName: string) {
    // If in version mode and name is different from original, show warning
    if (versioningMode === 'version' && initialDraft && newName !== initialDraft.name) {
      setPendingNameChange(newName);
      setShowNameChangeWarning(true);
    } else {
      setDraft({ ...draft, name: newName });
    }
  }

  // Confirm name change (creates new template instead of version)
  function confirmNameChange() {
    if (pendingNameChange !== null) {
      setDraft({ ...draft, name: pendingNameChange });
    }
    setShowNameChangeWarning(false);
    setPendingNameChange(null);
  }

  // Cancel name change
  function cancelNameChange() {
    setShowNameChangeWarning(false);
    setPendingNameChange(null);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-4">
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
                disabled={saving || currentValidationErrors.length > 0}
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
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="font-semibold text-red-800">{error}</span>
          </div>
        </div>
      )}

      {currentValidationErrors.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <h3 className="font-semibold text-red-800">Validation Errors</h3>
          </div>
          <ul className="list-disc list-inside text-red-700 space-y-1">
            {currentValidationErrors.map((error: string, index: number) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Template Info */}
      <div className="px-6 py-6">
        <div className="space-y-4 bg-white rounded-lg border-2 border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 border-b pb-3">Template Information</h3>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Template Name *
              {versioningMode === 'version' && (
                <span className="ml-2 text-xs text-blue-600 font-normal">
                  (Locked - creating new version)
                </span>
              )}
            </label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => handleNameChange(e.target.value)}
              disabled={versioningMode === 'version'}
              className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                versioningMode === 'version' 
                  ? 'border-gray-200 bg-gray-100 cursor-not-allowed text-gray-600' 
                  : 'border-gray-300'
              }`}
              placeholder="e.g., Client Onboarding Process"
              title={versioningMode === 'version' ? 'Name is locked when creating a new version. Changing it would create a new template instead.' : ''}
            />
            {versioningMode === 'version' && (
              <p className="text-xs text-gray-600 mt-1">
                💡 The name is locked to create version {initialDraft ? 'N+1' : '2'} of this template. To create a separate template, use "Duplicate as New Template" instead.
              </p>
            )}
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
      <div className="px-6 pb-6">
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

          <div className="h-[800px]">
            <WorkflowCanvas
              steps={canvasProps.steps}
              dependencies={canvasProps.dependencies}
              onChange={handleCanvasChange}
            />
          </div>
        </div>
      </div>

      {/* Name Change Warning Modal */}
      {showNameChangeWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    Warning: Name Change Detected
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    You are currently creating a <strong>new version</strong> of "{initialDraft?.name}".
                  </p>
                  <p className="text-sm text-gray-600 mb-3">
                    Changing the name to "<strong>{pendingNameChange}</strong>" will create a <strong>new template</strong> instead of a new version.
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
                    <p className="text-xs text-blue-800">
                      <strong>New Version:</strong> Same name → version auto-increments<br/>
                      <strong>New Template:</strong> Different name → version starts at 1
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">
                    Do you want to continue with the name change?
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3 justify-end">
                <button
                  onClick={cancelNameChange}
                  className="px-4 py-2 text-gray-700 bg-white border-2 border-gray-300 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmNameChange}
                  className="px-4 py-2 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700 transition-colors"
                >
                  Change Name (Create New Template)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
