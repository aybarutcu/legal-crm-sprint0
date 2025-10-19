"use client";

import { useEffect, useMemo, useState } from "react";
import { ActionConfigDisplay } from "@/components/workflows/ActionConfigDisplay";

type ActionType =
  | "APPROVAL_LAWYER"
  | "SIGNATURE_CLIENT"
  | "REQUEST_DOC_CLIENT"
  | "PAYMENT_CLIENT"
  | "CHECKLIST"
  | "WRITE_TEXT"
  | "POPULATE_QUESTIONNAIRE";

type RoleScope = "ADMIN" | "LAWYER" | "PARALEGAL" | "CLIENT";

type TemplateStep = {
  id: string;
  title: string;
  order: number;
  actionType: ActionType;
  roleScope: RoleScope;
  required: boolean;
  actionConfig: Record<string, unknown> | null;
};

type WorkflowTemplate = {
  id: string;
  name: string;
  description: string | null;
  version: number;
  isActive: boolean;
  steps: TemplateStep[];
};

type StartWorkflowDialogProps = {
  contactId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

type DialogState = "idle" | "loading" | "submitting";

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

export function StartWorkflowDialog({
  contactId,
  open,
  onOpenChange,
  onSuccess,
}: StartWorkflowDialogProps) {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [state, setState] = useState<DialogState>("idle");
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? null,
    [selectedId, templates],
  );

  async function handleStartWorkflow() {
    if (!selectedTemplate) return;
    setState("submitting");
    setToast(null);
    try {
      console.log("Starting workflow:", {
        contactId,
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
      });

      const response = await fetch(`/api/contacts/${contactId}/workflows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selectedTemplate.id }),
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        console.error("Error response:", body);
        throw new Error(body?.error ?? "Workflow could not be started");
      }

      const result = await response.json();
      console.log("Workflow created:", result);

      setToast({ type: "success", message: "Workflow started successfully." });
      onSuccess?.();
      window.setTimeout(() => {
        onOpenChange(false);
        setToast(null);
      }, 1200);
    } catch (err) {
      console.error("Failed to start workflow:", err);
      setToast({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "Workflow could not be started",
      });
    } finally {
      setState("idle");
    }
  }

  function handleClose() {
    onOpenChange(false);
    setToast(null);
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Start Workflow</h3>
            <p className="text-sm text-slate-500">
              Select a workflow template to track actions for this contact.
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

          {state === "idle" && templates.filter((t) => t.isActive).length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              No active workflow templates available. Please activate a template in the Workflow Templates page.
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
            <section className="max-h-[60vh] overflow-y-auto space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
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

              <div className="space-y-2">
                {selectedTemplate.steps.map((step) => (
                  <div
                    key={step.id}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-slate-900">{step.title}</div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span className="rounded bg-slate-100 px-2 py-0.5 font-medium uppercase tracking-wide text-slate-600">
                            {step.actionType.replace(/_/g, " ")}
                          </span>
                          <span className="rounded bg-slate-100 px-2 py-0.5 font-medium uppercase tracking-wide text-slate-600">
                            {step.roleScope}
                          </span>
                          <span className="rounded bg-slate-100 px-2 py-0.5 font-medium uppercase tracking-wide text-slate-600">
                            {step.required ? "Required" : "Optional"}
                          </span>
                        </div>
                        {step.actionConfig && Object.keys(step.actionConfig).length > 0 ? (
                          <div className="mt-2 pt-2 border-t border-slate-200">
                            <ActionConfigDisplay
                              actionType={step.actionType}
                              config={step.actionConfig}
                              variant="compact"
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
              onClick={handleStartWorkflow}
              disabled={state !== "idle" || !selectedTemplate}
              className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-60"
            >
              {state === "submitting" ? "Starting..." : "Start Workflow"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
