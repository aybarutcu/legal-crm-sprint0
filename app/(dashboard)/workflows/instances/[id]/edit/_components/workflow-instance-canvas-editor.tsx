"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { WorkflowCanvas } from "@/components/workflows/WorkflowCanvas";
import type { WorkflowStep as CanvasWorkflowStep } from "@/components/workflows/WorkflowCanvas";
import type { ActionType, RoleScope, ActionState, TaskPriority } from "@prisma/client";
import { ArrowLeft, Save, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { WorkflowDependency } from "@/components/workflows/types";

type User = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
};

type WorkflowStep = {
  id: string;
  title: string;
  actionType: ActionType;
  roleScope: RoleScope;
  required: boolean;
  actionState: ActionState;
  actionData: unknown;
  assignedToId: string | null;
  assignedTo: { id: string; name: string | null; email: string | null } | null;
  dueDate: string | null;
  priority: TaskPriority | null;
  notes: string | null;
  startedAt: string | null;
  completedAt: string | null;
  positionX: number | null;
  positionY: number | null;
  dependsOn?: string[];
  dependencyLogic?: string;
  conditionType?: string | null;
  conditionConfig?: unknown | null;
  nextStepOnTrue?: string | null;
  nextStepOnFalse?: string | null;
  createdAt: string;
  updatedAt: string;
};

type WorkflowInstance = {
  id: string;
  templateId: string;
  matterId: string | null;
  contactId: string | null;
  templateVersion: number;
  status: string;
  contextData: unknown;
  createdAt: string;
  updatedAt: string;
  template: {
    id: string;
    name: string;
    description: string | null;
  };
  matter: {
    id: string;
    title: string;
  } | null;
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    type: string;
  } | null;
  steps: WorkflowStep[];
  dependencies: WorkflowDependency[];
  createdBy: {
    id: string;
    name: string | null;
    email: string | null;
  };
};

type Props = {
  instance: WorkflowInstance;
  users: User[];
  contextTitle: string;
  contextType: "matter" | "contact";
};

export function WorkflowInstanceCanvasEditor({
  instance: initialInstance,
  users: _users,
  contextTitle,
  contextType,
}: Props) {
  const router = useRouter();
  const [instance, setInstance] = useState(initialInstance);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showImportantNotes, setShowImportantNotes] = useState(false);
  const [showCanvasControls, setShowCanvasControls] = useState(false);

  const getBackUrl = () => {
    if (contextType === "matter" && instance.matterId) {
      return `/matters/${instance.matterId}`;
    }
    if (contextType === "contact" && instance.contactId) {
      return `/contacts/${instance.contactId}`;
    }
    return "/dashboard";
  };

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Convert workflow instance steps to canvas format
  const canvasSteps = useMemo(
    () =>
      instance.steps.map((step) => ({
        id: step.id,
        title: step.title,
        actionType: step.actionType as CanvasWorkflowStep["actionType"],
        roleScope: step.roleScope as CanvasWorkflowStep["roleScope"],
        required: step.required,
        actionConfig: step.actionData,
        positionX: step.positionX ?? undefined,
        positionY: step.positionY ?? undefined,
      } as CanvasWorkflowStep)),
    [instance.steps]
  );

  // Handle canvas changes
  const handleCanvasChange = useCallback(
    (updatedSteps: CanvasWorkflowStep[], updatedDependencies?: WorkflowDependency[]) => {
      setInstance((currentInstance) => {
        const updatedInstanceSteps = updatedSteps.map((canvasStep, idx) => {
          // Find the original step to preserve metadata
          const originalStep = currentInstance.steps.find((s) => s.id === canvasStep.id) || 
            currentInstance.steps[idx];

          return {
            ...originalStep,
            id: canvasStep.id || originalStep?.id || `temp-${idx}`,
            title: canvasStep.title,
            actionType: canvasStep.actionType as ActionType,
            roleScope: canvasStep.roleScope as RoleScope,
            required: canvasStep.required ?? true,
            actionData: canvasStep.actionConfig || {},
            dependsOn: originalStep?.dependsOn || [],
            dependencyLogic: originalStep?.dependencyLogic || "ALL",
            conditionType: originalStep?.conditionType || null,
            conditionConfig: originalStep?.conditionConfig || null,
            nextStepOnTrue: originalStep?.nextStepOnTrue || null,
            nextStepOnFalse: originalStep?.nextStepOnFalse || null,
            positionX: canvasStep.positionX ?? originalStep?.positionX ?? null,
            positionY: canvasStep.positionY ?? originalStep?.positionY ?? null,
          };
        });

        const normalizedSteps = updatedInstanceSteps.map((step) => ({
          ...step,
          assignedToId: step.assignedToId ?? null,
          dueDate: step.dueDate ?? null,
          priority: step.priority ?? null,
          notes: step.notes ?? null,
          nextStepOnTrue: step.nextStepOnTrue ?? null,
          nextStepOnFalse: step.nextStepOnFalse ?? null,
        }));

        return {
          ...currentInstance,
          steps: normalizedSteps,
          dependencies: updatedDependencies || currentInstance.dependencies,
        };
      });
    },
    []
  );

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      console.log("Saving workflow instance", {
        instanceId: instance.id,
        steps: instance.steps.map((step) => ({
          id: step.id,
          nextStepOnTrue: step.nextStepOnTrue,
          nextStepOnFalse: step.nextStepOnFalse,
        })),
      });
      
     const response = await fetch(`/api/workflows/instances/${instance.id}/edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steps: instance.steps
            .filter((step) => typeof step.id === "string" && step.id.trim().length > 0)
            .map((step) => ({
              id: step.id,
              title: step.title,
              actionType: step.actionType,
              roleScope: step.roleScope,
              required: step.required,
              actionData: step.actionData,
              assignedToId: step.assignedToId,
              dueDate: step.dueDate,
              priority: step.priority,
              notes: step.notes,
              positionX: step.positionX,
              positionY: step.positionY,
            })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Failed to save changes (${response.status})`);
      }

      showToast("Workflow instance updated successfully!", "success");
      
      // Redirect back after a short delay
      setTimeout(() => {
        router.push(getBackUrl());
        router.refresh();
      }, 1500);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to save changes");
      showToast(
        err instanceof Error ? err.message : "Failed to save changes",
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    router.push(getBackUrl());
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={getBackUrl()}
                className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="font-medium">Back</span>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Edit Workflow: {instance.template.name}
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  {contextType === "matter" ? "Matter" : "Contact"}: {contextTitle} • Status:{" "}
                  <span className="font-semibold">{instance.status}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSaving}
                className="px-5 py-2.5 text-gray-700 bg-white border-2 border-gray-300 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="px-6 py-4">
          <div className="rounded-lg bg-red-50 border-2 border-red-200 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Important Notes */}
      <div className="px-6 py-4">
        <div className="rounded-lg bg-yellow-50 border-2 border-yellow-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowImportantNotes(!showImportantNotes)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-yellow-100 transition-colors"
          >
            <h3 className="text-sm font-bold text-yellow-900 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Important Notes
            </h3>
            {showImportantNotes ? (
              <ChevronDown className="h-4 w-4 text-yellow-900" />
            ) : (
              <ChevronRight className="h-4 w-4 text-yellow-900" />
            )}
          </button>
          {showImportantNotes && (
            <div className="px-4 pb-4">
              <ul className="text-sm text-yellow-800 space-y-1 ml-6 list-disc">
                <li>Completed and in-progress steps cannot be edited (preserves history)</li>
                <li>You can only delete PENDING or READY steps</li>
                <li>Changes will be saved when you click "Save Changes"</li>
                <li>Visual positions and dependencies can be adjusted on the canvas</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Canvas Editor */}
      <div className="px-6 py-6">
        <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-bold text-gray-900">Visual Workflow Editor</h2>
            <p className="text-sm text-gray-600 mt-1">
              Use the canvas below to visualize and edit your workflow instance
            </p>
          </div>
          
          <div className="bg-blue-50 border-b-2 border-blue-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowCanvasControls(!showCanvasControls)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-blue-100 transition-colors"
            >
              <p className="font-semibold text-sm text-blue-800">🎨 Canvas Controls</p>
              {showCanvasControls ? (
                <ChevronDown className="h-4 w-4 text-blue-800" />
              ) : (
                <ChevronRight className="h-4 w-4 text-blue-800" />
              )}
            </button>
            {showCanvasControls && (
              <div className="px-4 pb-4">
                <ul className="text-sm text-blue-800 space-y-1 ml-4 list-disc">
                  <li>Click and drag nodes to reposition them</li>
                  <li>Click a node to view and edit its properties</li>
                  <li>Drag from the green connection point to create dependencies</li>
                  <li>Select an edge and press Delete to remove a dependency</li>
                  <li>Use the controls (bottom-left) to zoom and fit the view</li>
                </ul>
              </div>
            )}
          </div>

          <div className="h-[800px]">
            <WorkflowCanvas steps={canvasSteps} dependencies={instance.dependencies} onChange={handleCanvasChange} />
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5">
          <div
            className={`rounded-lg px-6 py-4 text-sm font-semibold shadow-lg ${
              toast.type === "success"
                ? "bg-emerald-600 text-white"
                : "bg-rose-600 text-white"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
