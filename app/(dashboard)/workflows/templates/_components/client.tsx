"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TemplateGroup } from "@/components/workflows/TemplateGroup";
import { ActionConfigForm } from "@/components/workflows/config-forms";

const ACTION_TYPES = [
  { value: "TASK", label: "Task" },
  { value: "CHECKLIST", label: "Checklist" },
  { value: "APPROVAL_LAWYER", label: "Lawyer Approval" },
  { value: "SIGNATURE_CLIENT", label: "Client Signature" },
  { value: "REQUEST_DOC_CLIENT", label: "Request Documents" },
  { value: "PAYMENT_CLIENT", label: "Client Payment" },
  { value: "WRITE_TEXT", label: "Write Text" },
  { value: "POPULATE_QUESTIONNAIRE", label: "Questionnaire" },
] as const;

const ROLE_SCOPES = [
  { value: "ADMIN", label: "Admin" },
  { value: "LAWYER", label: "Lawyer" },
  { value: "PARALEGAL", label: "Paralegal" },
  { value: "CLIENT", label: "Client" },
] as const;

type ActionType = (typeof ACTION_TYPES)[number]["value"];
type RoleScope = (typeof ROLE_SCOPES)[number]["value"];

function defaultConfigFor(actionType: ActionType): Record<string, unknown> {
  switch (actionType) {
    case "TASK":
      return { description: "", requiresEvidence: false, estimatedMinutes: undefined };
    case "APPROVAL_LAWYER":
      return { approverRole: "LAWYER", message: "" };
    case "SIGNATURE_CLIENT":
      return { documentId: null, provider: "mock" };
    case "REQUEST_DOC_CLIENT":
      return { requestText: "", documentNames: [] };
    case "PAYMENT_CLIENT":
      return { amount: 0, currency: "USD", provider: "mock" };
    case "WRITE_TEXT":
      return {
        title: "",
        description: "",
        placeholder: "Enter your text here...",
        minLength: 0,
        maxLength: undefined,
        required: true,
      };
    case "POPULATE_QUESTIONNAIRE":
      return { questionnaireId: null, title: "", description: "", dueInDays: undefined };
    case "CHECKLIST":
    default:
      return { items: [] };
  }
}

type WorkflowStep = {
  id?: string;
  title: string;
  actionType: ActionType | string; // Allow string for compatibility with imported templates
  roleScope: RoleScope | string; // Allow string for compatibility with imported templates
  required: boolean;
  actionConfig: Record<string, unknown>;
  actionConfigInput?: string;
  order: number;
};

type WorkflowTemplate = {
  id: string;
  name: string;
  description: string | null;
  version: number;
  isActive: boolean;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
};

type WorkflowTemplateDraft = {
  id?: string;
  isActive?: boolean;
  name: string;
  description: string;
  steps: WorkflowStep[];
};

const defaultTaskConfig = defaultConfigFor("TASK");

const emptyDraft: WorkflowTemplateDraft = {
  name: "",
  description: "",
  steps: [
    {
      title: "New Task",
      actionType: "TASK",
      roleScope: "ADMIN",
      required: true,
      actionConfig: defaultTaskConfig,
      actionConfigInput: JSON.stringify(defaultTaskConfig, null, 2),
      order: 0,
    },
  ],
};

function normaliseSteps(steps: WorkflowStep[]): WorkflowStep[] {
  return steps.map((step, index) => ({
    ...step,
    order: index,
  }));
}

export function WorkflowTemplatesClient() {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState<WorkflowTemplateDraft | null>(null);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    void fetchTemplates();
  }, []);

  const isEditorOpen = Boolean(draft);

  async function fetchTemplates() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/workflows/templates");
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          typeof payload?.error === "string" && payload.error.length > 0
            ? payload.error
            : `Workflow templates could not be loaded (${response.status})`,
        );
      }
      const data = (await response.json()) as WorkflowTemplate[];
      setTemplates(
        data.map((template) => ({
          ...template,
          steps: normaliseSteps(
            template.steps
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((step) => ({
                ...step,
                actionConfig: step.actionConfig ?? {},
                actionConfigInput: JSON.stringify(step.actionConfig ?? {}, null, 2),
              })),
          ),
        })),
      );
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Workflow templates could not be loaded",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function openCreateEditor() {
    setMode("create");
    setDraft({
      ...emptyDraft,
      steps: emptyDraft.steps.map((step) => {
        const config = JSON.parse(JSON.stringify(step.actionConfig ?? {})) as Record<string, unknown>;
        return {
          ...step,
          actionConfig: config,
          actionConfigInput: JSON.stringify(config, null, 2),
        };
      }),
    });
    setError(null);
  }

  function startNewVersion(template: WorkflowTemplate) {
    setMode("create");
    setDraft({
      name: template.name,
      description: template.description ?? "",
      steps: normaliseSteps(
        template.steps.map((step) => {
          const config = JSON.parse(JSON.stringify(step.actionConfig ?? {})) as Record<string, unknown>;
          return {
            ...step,
            id: undefined,
            actionConfig: config,
            actionConfigInput: JSON.stringify(config, null, 2),
          };
        }),
      ),
    });
    setError(null);
  }

  function openEditEditor(template: WorkflowTemplate) {
    setMode("edit");
    setDraft({
      id: template.id,
      isActive: template.isActive,
      name: template.name,
      description: template.description ?? "",
      steps: normaliseSteps(
        template.steps.map((step) => {
          const config = JSON.parse(JSON.stringify(step.actionConfig ?? {})) as Record<string, unknown>;
          return {
            ...step,
            actionConfig: config,
            actionConfigInput:
              typeof step.actionConfigInput === "string"
                ? step.actionConfigInput
                : JSON.stringify(config, null, 2),
          };
        }),
      ),
    });
    setError(null);
  }

  function closeEditor() {
    setDraft(null);
    setSaving(false);
  }

  function updateDraft(partial: Partial<WorkflowTemplateDraft>) {
    setDraft((prev) => (prev ? { ...prev, ...partial } : prev));
  }

  function updateStep(index: number, patch: Partial<WorkflowStep>) {
    setDraft((prev) => {
      if (!prev) return prev;
      const steps = prev.steps.map((step, i) => (i === index ? { ...step, ...patch } : step));
      return { ...prev, steps };
    });
  }

  function addStep(afterIndex: number) {
    setDraft((prev) => {
      if (!prev) return prev;
      const steps = prev.steps.slice();
      const insertAt = Math.min(Math.max(afterIndex + 1, 0), steps.length);
      const neighbourIndex = Math.max(0, insertAt - 1);
      const neighbour = steps[neighbourIndex];
      const nextActionType = (neighbour?.actionType ?? "TASK") as ActionType;
      const defaultConfig = defaultConfigFor(nextActionType);
      steps.splice(insertAt, 0, {
        title: "New Step",
        actionType: nextActionType,
        roleScope: neighbour?.roleScope ?? "ADMIN",
        required: true,
        actionConfig: defaultConfig,
        actionConfigInput: JSON.stringify(defaultConfig, null, 2),
        order: insertAt,
      });
      return {
        ...prev,
        steps: normaliseSteps(steps),
      };
    });
  }

  function removeStep(index: number) {
    setDraft((prev) => {
      if (!prev) return prev;
      if (prev.steps.length === 1) {
        return prev;
      }
      const steps = prev.steps.filter((_, i) => i !== index);
      return {
        ...prev,
        steps: normaliseSteps(steps),
      };
    });
  }

  function moveStep(index: number, direction: -1 | 1) {
    setDraft((prev) => {
      if (!prev) return prev;
      const target = index + direction;
      if (target < 0 || target >= prev.steps.length) {
        return prev;
      }
      const steps = prev.steps.slice();
      const [removed] = steps.splice(index, 1);
      steps.splice(target, 0, removed);
      return {
        ...prev,
        steps: normaliseSteps(steps),
      };
    });
  }

  

  async function submitDraft() {
    if (!draft) return;

    let parsedSteps: Array<{
      title: string;
      actionType: ActionType | string;
      roleScope: RoleScope | string;
      required: boolean;
      actionConfig: Record<string, unknown>;
      order: number;
    }>;

    try {
      parsedSteps = draft.steps.map((step, index) => {
        const configSource =
          typeof step.actionConfigInput === "string"
            ? step.actionConfigInput.trim()
            : JSON.stringify(step.actionConfig ?? {}, null, 2);
        const parsedConfig =
          configSource.length === 0 ? {} : (JSON.parse(configSource) as Record<string, unknown>);
        return {
          title: step.title.trim(),
          actionType: step.actionType,
          roleScope: step.roleScope,
          required: step.required ?? true,
          actionConfig: parsedConfig,
          order: index,
        };
      });
    } catch {
      setError("Step configuration must be valid JSON.");
      return;
    }

    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      steps: parsedSteps,
    };

    if (!payload.name) {
      setError("Template name is required.");
      return;
    }

    if (payload.steps.some((step) => !step.title)) {
      setError("Each step requires a title.");
      return;
    }

    setSaving(true);
    try {
      const endpoint =
        mode === "create"
          ? "/api/workflows/templates"
          : `/api/workflows/templates/${draft.id}`;

      const response = await fetch(endpoint, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Template could not be saved");
      }

      await fetchTemplates();
      closeEditor();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Template could not be saved");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate(id: string) {
    if (!window.confirm("Delete this workflow template?")) return;
    try {
      setIsDeleting(id);
      const response = await fetch(`/api/workflows/templates/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Template could not be deleted");
      }
      await fetchTemplates();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Template could not be deleted");
    } finally {
      setIsDeleting(null);
    }
  }

  async function publishTemplate(id: string) {
    try {
      setPublishingId(id);
      const response = await fetch(`/api/workflows/templates/${id}/publish`, {
        method: "POST",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Template could not be published");
      }
      await fetchTemplates();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Template could not be published");
    } finally {
      setPublishingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-900">Workflow Templates</h2>
          <p className="text-sm text-slate-600 mt-1.5">
            Define reusable, role-based action sequences that matters can instantiate and track.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openCreateEditor}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-accent/90 shadow-sm hover:shadow-md transition-all flex items-center gap-2"
          >
            <span className="text-lg">+</span>
            New Template
          </button>
          <Link
            href="/workflows/ai"
            className="rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:from-purple-700 hover:to-blue-700 shadow-sm hover:shadow-md transition-all flex items-center gap-2"
          >
            <span className="text-base">✨</span>
            AI Workflow Oluştur
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-card">
          Loading templates...
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-card">
          No workflow templates yet. Create your first template to standardise critical processes.
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(
            templates.reduce((acc, template) => {
              if (!acc[template.name]) {
                acc[template.name] = [];
              }
              acc[template.name].push(template);
              return acc;
            }, {} as Record<string, WorkflowTemplate[]>)
          ).map(([name, versions]) => (
            <TemplateGroup
              key={name}
              name={name}
              versions={versions}
              startNewVersion={startNewVersion}
              publishTemplate={publishTemplate}
              openEditEditor={openEditEditor}
              deleteTemplate={deleteTemplate}
              isDeleting={isDeleting}
              publishingId={publishingId}
            />
          ))}
        </div>
      )}

      {isEditorOpen && draft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border-2 border-slate-200 bg-white shadow-2xl">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-white border-b-2 border-slate-200 px-8 py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">
                    {mode === "create" ? "🎯 New Workflow Template" : "✏️ Edit Workflow Template"}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1.5">
                    Configure each action with a performer role and optional configuration
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeEditor}
                  className="flex-shrink-0 rounded-lg border-2 border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50"
                  disabled={saving}
                >
                  × Close
                </button>
              </div>
            </header>

            <div className="px-8 py-6 space-y-6">
              {/* Template Info Section */}
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <h4 className="text-sm font-bold text-slate-900 mb-4">Template Information</h4>
                <div className="space-y-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-slate-700">Template Name</span>
                    <input
                      value={draft.name}
                      onChange={(event) => updateDraft({ name: event.target.value })}
                      className="rounded-lg border-2 border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
                      placeholder="e.g., Discovery Kickoff"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-slate-700">Description</span>
                    <textarea
                      value={draft.description}
                      onChange={(event) => updateDraft({ description: event.target.value })}
                      rows={2}
                      className="rounded-lg border-2 border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all resize-none"
                      placeholder="Optional context for this workflow template"
                    />
                  </label>
                </div>
              </div>

              <section className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="text-base font-bold text-slate-900 mb-1">
                      Workflow Steps
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Steps execute in order. The first required step will start in READY state when the workflow is instantiated.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addStep(draft.steps.length - 1)}
                    className="flex-shrink-0 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 shadow-sm hover:shadow transition-all"
                  >
                    + Add Step
                  </button>
                </div>

                <div className="space-y-4">
                  {draft.steps.map((step, index) => (
                    <div key={index} className="relative rounded-xl border-2 border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-5 shadow-sm hover:shadow-md transition-shadow">
                      {/* Step Number Badge */}
                      <div className="absolute -left-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-white shadow-lg border-2 border-white">
                        {index + 1}
                      </div>
                      
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <span className="text-sm font-semibold text-slate-700">
                          Step {index + 1} Configuration
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => moveStep(index, -1)}
                            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            disabled={index === 0}
                            title="Move up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveStep(index, 1)}
                            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            disabled={index === draft.steps.length - 1}
                            title="Move down"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => addStep(index)}
                            className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-colors"
                            title="Add step after this"
                          >
                            + Add
                          </button>
                          <button
                            type="button"
                            onClick={() => removeStep(index)}
                            className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 hover:border-red-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            disabled={draft.steps.length === 1}
                            title="Remove step"
                          >
                            × Remove
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        {/* Title Field - Full Width */}
                        <label className="flex flex-col gap-1.5 md:col-span-2">
                          <span className="text-xs font-semibold text-slate-700">Step Title</span>
                          <input
                            value={step.title}
                            onChange={(event) => updateStep(index, { title: event.target.value })}
                            className="rounded-lg border-2 border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
                            placeholder="e.g., Checklist: Discovery hazırlık"
                          />
                        </label>
                        
                        {/* Action Type */}
                        <label className="flex flex-col gap-1.5">
                          <span className="text-xs font-semibold text-slate-700">Action Type</span>
                          <select
                            value={step.actionType}
                            onChange={(event) => {
                              const nextType = event.target.value as ActionType;
                              const config = defaultConfigFor(nextType);
                              updateStep(index, {
                                actionType: nextType,
                                actionConfig: config,
                                actionConfigInput: JSON.stringify(config, null, 2),
                              });
                            }}
                            className="rounded-lg border-2 border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all bg-white"
                          >
                            {ACTION_TYPES.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        
                        {/* Role Scope */}
                        <label className="flex flex-col gap-1.5">
                          <span className="text-xs font-semibold text-slate-700">Role Scope</span>
                          <select
                            value={step.roleScope}
                            onChange={(event) =>
                              updateStep(index, {
                                roleScope: event.target.value as RoleScope,
                              })
                            }
                            className="rounded-lg border-2 border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all bg-white"
                          >
                            {ROLE_SCOPES.map((role) => (
                              <option key={role.value} value={role.value}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        
                        {/* Required Checkbox */}
                        <label className="flex items-center gap-2.5 md:col-span-2 cursor-pointer p-3 rounded-lg hover:bg-slate-50 transition-colors">
                          <input
                            type="checkbox"
                            checked={step.required}
                            onChange={(event) =>
                              updateStep(index, { required: event.target.checked })
                            }
                            className="h-5 w-5 rounded border-2 border-slate-300 text-accent focus:ring-2 focus:ring-accent/20 cursor-pointer"
                          />
                          <span className="text-sm font-medium text-slate-700">
                            Required step (cannot be skipped)
                          </span>
                        </label>
                        {/* Action Configuration Section */}
                        <div className="md:col-span-2 mt-2">
                          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                            <h5 className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-2">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent"></span>
                              Action Configuration
                            </h5>
                            <ActionConfigForm
                              actionType={step.actionType as ActionType}
                              config={step.actionConfig}
                              onChange={(newConfig) => {
                                updateStep(index, {
                                  actionConfig: newConfig,
                                  actionConfigInput: JSON.stringify(newConfig, null, 2),
                                });
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Footer */}
            <footer className="sticky bottom-0 z-10 bg-white border-t-2 border-slate-200 px-8 py-5">
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-slate-600">
                  {draft.steps.length} step{draft.steps.length !== 1 ? 's' : ''} configured
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={closeEditor}
                    className="rounded-lg border-2 border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitDraft}
                    className="rounded-lg bg-accent px-6 py-2.5 text-sm font-bold text-white hover:bg-accent/90 shadow-lg hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                    disabled={saving}
                  >
                    {saving ? "⏳ Saving..." : mode === "create" ? "✓ Create Template" : "✓ Save Changes"}
                  </button>
                </div>
              </div>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
