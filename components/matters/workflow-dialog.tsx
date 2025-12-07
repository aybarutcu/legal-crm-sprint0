"use client";

import { useEffect, useMemo, useState } from "react";
import "reactflow/dist/style.css";
import type { ActionType, RoleScope } from "@prisma/client";
import {
  WorkflowTemplatePreview,
  type WorkflowTemplatePreviewStep,
  type WorkflowTemplatePreviewDependency,
} from "@/components/workflows/WorkflowTemplatePreview";

type TemplateStep = {
  id: string;
  title: string;
  order: number;
  actionType: ActionType;
  roleScope: RoleScope;
  required: boolean;
  actionConfig: Record<string, unknown> | null;
  positionX?: number | null;
  positionY?: number | null;
};

type WorkflowDependency = {
  id: string;
  sourceStepId: string;
  targetStepId: string;
  dependencyType: "DEPENDS_ON" | "TRIGGERS" | "IF_TRUE_BRANCH" | "IF_FALSE_BRANCH";
  dependencyLogic: "ALL" | "ANY" | "CUSTOM";
  conditionType?: "ALWAYS" | "IF_TRUE" | "IF_FALSE" | "SWITCH";
  conditionConfig?: Record<string, unknown>;
};

type WorkflowTemplate = {
  id: string;
  name: string;
  description: string | null;
  version: number;
  isActive: boolean;
  steps: TemplateStep[];
  dependencies?: WorkflowDependency[];
};

type WorkflowDialogProps = {
  matterId: string;
  isOpen: boolean;
  onClose: () => void;
  onInstantiated?: () => void;
};

type DialogState = "idle" | "loading" | "submitting";

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

export function WorkflowDialog({
  matterId,
  isOpen,
  onClose,
  onInstantiated,
}: WorkflowDialogProps) {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [state, setState] = useState<DialogState>("idle");
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedId("");
    setState("loading");
    setToast(null);

    void (async () => {
      try {
        const response = await fetch("/api/workflows/templates");
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error ?? "Templates could not be loaded");
        }
        const data = (await response.json()) as WorkflowTemplate[];
        setTemplates(
          data.map((template) => ({
            ...template,
            steps: template.steps
              .slice()
              .sort((a, b) => a.order - b.order),
          })),
        );
      } catch (err) {
        console.error(err);
        setToast({
          type: "error",
          message:
            err instanceof Error
              ? err.message
              : "Workflow templates could not be loaded",
        });
      } finally {
        setState("idle");
      }
    })();
  }, [isOpen]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? null,
    [selectedId, templates],
  );

  const previewSteps = useMemo(
    () => (selectedTemplate ? mapTemplateStepsToPreview(selectedTemplate.steps) : []),
    [selectedTemplate],
  );

  const previewDependencies = useMemo(
    () => (selectedTemplate ? mapTemplateDependenciesToPreview(selectedTemplate.dependencies || []) : []),
    [selectedTemplate],
  );

  async function handleInstantiate() {
    if (!selectedTemplate) return;
    setState("submitting");
    setToast(null);
    try {
        const response = await fetch(
          `/api/workflows/templates/${selectedTemplate.id}/instantiate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matterId }),
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Workflow could not be instantiated");
      }

      setToast({ type: "success", message: "Workflow added to matter." });
      onInstantiated?.();
      window.setTimeout(() => {
        onClose();
        setToast(null);
      }, 1200);
    } catch (err) {
      console.error(err);
      setToast({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "Workflow could not be instantiated",
      });
    } finally {
      setState("idle");
    }
  }

  function handleClose() {
    onClose();
    setToast(null);
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Add Workflow</h3>
            <p className="text-sm text-slate-500">
              Select a workflow template to assign its action sequence to this matter.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100"
            disabled={state === "submitting"}
          >
            Close
          </button>
        </header>

        <div className="mt-6 space-y-4">
          {toast ? (
            <div
              className={`rounded-lg border px-3 py-2 text-sm ${
                toast.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {toast.message}
            </div>
          ) : null}

          <label className="text-sm font-medium text-slate-700">
            Workflow Template
            <select
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
              disabled={state !== "idle"}
            >
              <option value="">Select a template</option>
              {templates
                .filter((template) => template.isActive) // Show only active templates
                .map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} (v{template.version})
                  </option>
                ))}
            </select>
          </label>

          {selectedTemplate ? (
            <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">
                    {selectedTemplate.name}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {selectedTemplate.description || "No description provided."}
                  </p>
                </div>
                {selectedTemplate.isActive ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Active
                  </span>
                ) : null}
              </div>

              {selectedTemplate.steps.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
                  This template does not contain any steps yet.
                </div>
              ) : (
                <WorkflowTemplatePreview steps={previewSteps} dependencies={previewDependencies} />
              )}
            </section>
          ) : null}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              disabled={state === "submitting"}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleInstantiate}
              disabled={state !== "idle" || !selectedTemplate}
              className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-60"
            >
              {state === "submitting" ? "Adding..." : "Add Workflow"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function mapTemplateStepsToPreview(steps: TemplateStep[]): WorkflowTemplatePreviewStep[] {
  return steps.map((step, index) => {
    const order = step.order ?? index;

    return {
      id: step.id,
      title: step.title,
      order,
      actionType: step.actionType,
      roleScope: step.roleScope,
      required: step.required,
      actionConfig: step.actionConfig ?? {},
      positionX: typeof step.positionX === "number" ? step.positionX : undefined,
      positionY: typeof step.positionY === "number" ? step.positionY : undefined,
    };
  });
}

function mapTemplateDependenciesToPreview(dependencies: WorkflowDependency[]): WorkflowTemplatePreviewDependency[] {
  return dependencies.map((dep) => ({
    id: dep.id,
    sourceStepId: dep.sourceStepId,
    targetStepId: dep.targetStepId,
    dependencyType: dep.dependencyType,
    dependencyLogic: dep.dependencyLogic,
    conditionType: dep.conditionType,
    conditionConfig: dep.conditionConfig,
  }));
}
