"use client";

import { useEffect, useState } from "react";

const ACTION_TYPES = [
  { value: "CHECKLIST", label: "Checklist" },
  { value: "APPROVAL_LAWYER", label: "Lawyer Approval" },
  { value: "SIGNATURE_CLIENT", label: "Client Signature" },
  { value: "REQUEST_DOC_CLIENT", label: "Request Documents" },
  { value: "PAYMENT_CLIENT", label: "Client Payment" },
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
    case "APPROVAL_LAWYER":
      return { approverRole: "LAWYER", message: "" };
    case "SIGNATURE_CLIENT":
      return { documentId: null, provider: "mock" };
    case "REQUEST_DOC_CLIENT":
      return { requestText: "", acceptedTypes: [] };
    case "PAYMENT_CLIENT":
      return { amount: 0, currency: "USD", provider: "mock" };
    case "CHECKLIST":
    default:
      return { items: [] };
  }
}

type WorkflowStep = {
  id?: string;
  title: string;
  actionType: ActionType;
  roleScope: RoleScope;
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

const defaultChecklistConfig = defaultConfigFor("CHECKLIST");

const emptyDraft: WorkflowTemplateDraft = {
  name: "",
  description: "",
  steps: [
    {
      title: "New Task",
      actionType: "CHECKLIST",
      roleScope: "ADMIN",
      required: true,
      actionConfig: defaultChecklistConfig,
      actionConfigInput: JSON.stringify(defaultChecklistConfig, null, 2),
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
      const nextActionType = neighbour?.actionType ?? "CHECKLIST";
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

  function addChecklistItem(afterTaskIndex: number) {
    setDraft((prev) => {
      if (!prev) return prev;
      const steps = prev.steps.slice();
      const insertAt = Math.min(afterTaskIndex + 1, steps.length);
      const defaultConfig = defaultConfigFor("CHECKLIST");
      steps.splice(insertAt, 0, {
        title: "Checklist item",
        actionType: "CHECKLIST",
        roleScope: "CLIENT",
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

  async function submitDraft() {
    if (!draft) return;

    let parsedSteps: Array<{
      title: string;
      actionType: ActionType;
      roleScope: RoleScope;
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Workflow Templates</h2>
          <p className="text-sm text-slate-500">
            Define reusable, role-based action sequences that matters can instantiate and track.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateEditor}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
        >
          New Template
        </button>
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
          {templates.map((template) => (
            <article
              key={template.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card"
            >
              <header className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {template.name} <span className="text-xs font-medium text-slate-500">v{template.version}</span>
                  </h3>
                  <p className="text-sm text-slate-500">
                    {template.description || "No description provided."}
                  </p>
                  <p className="text-xs text-slate-400">
                    Updated {new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(template.updatedAt))}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-500"
                  >
                    {template.isActive ? "Active" : "Draft"}
                  </span>
                  {template.isActive ? (
                    <button
                      type="button"
                      onClick={() => startNewVersion(template)}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-600 hover:bg-slate-100"
                    >
                      New Version
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => publishTemplate(template.id)}
                      className="rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                      disabled={publishingId === template.id}
                    >
                      {publishingId === template.id ? "Publishing..." : "Publish"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openEditEditor(template)}
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    disabled={template.isActive}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteTemplate(template.id)}
                    className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-red-600 hover:bg-red-50"
                    disabled={isDeleting === template.id}
                  >
                    {isDeleting === template.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </header>
              <div className="mt-4 space-y-3">
                {template.steps.map((step) => (
                  <div
                    key={`${template.id}-${step.order}`}
                    className="flex items-start justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  >
                    <div>
                      <div className="font-medium text-slate-900">{step.title}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold uppercase tracking-wide text-slate-600">
                          {step.actionType.replace(/_/g, " ")}
                        </span>
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold uppercase tracking-wide text-slate-600">
                          {step.roleScope}
                        </span>
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold uppercase tracking-wide text-slate-600">
                          {step.required ? "Required" : "Optional"}
                        </span>
                      </div>
                    </div>
                    {Object.keys(step.actionConfig ?? {}).length > 0 ? (
                      <pre className="ml-4 max-w-xs overflow-auto rounded bg-slate-100 px-2 py-1 text-[11px] font-mono text-slate-600">
                        {JSON.stringify(step.actionConfig, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}

      {isEditorOpen && draft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <header className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {mode === "create" ? "New Workflow Template" : "Edit Workflow Template"}
                </h3>
                <p className="text-sm text-slate-500">
                  Configure each action with a performer role and optional configuration. Steps execute in order;
                  the first required step will start in READY state when instantiated.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100"
                disabled={saving}
              >
                Close
              </button>
            </header>

            <div className="mt-6 space-y-4">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Name
                <input
                  value={draft.name}
                  onChange={(event) => updateDraft({ name: event.target.value })}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  placeholder="Discovery Kickoff"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Description
                <textarea
                  value={draft.description}
                  onChange={(event) => updateDraft({ description: event.target.value })}
                  rows={3}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  placeholder="Optional context for this workflow"
                />
              </label>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
                    Steps
                  </h4>
                  <button
                    type="button"
                    onClick={() => addStep(draft.steps.length - 1)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-slate-600 hover:bg-slate-100"
                  >
                    Add Step
                  </button>
                </div>

                <p className="text-xs text-slate-500">
                  Action configuration is stored as JSON and passed to handlers at runtime. Use the role scope to
                  determine who can execute the step.
                </p>

                <div className="space-y-3">
                  {draft.steps.map((step, index) => (
                    <div key={index} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                          Step {index + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => moveStep(index, -1)}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold uppercase tracking-widest text-slate-600 hover:bg-slate-100"
                            disabled={index === 0}
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            onClick={() => moveStep(index, 1)}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold uppercase tracking-widest text-slate-600 hover:bg-slate-100"
                            disabled={index === draft.steps.length - 1}
                          >
                            Down
                          </button>
                          <button
                            type="button"
                            onClick={() => removeStep(index)}
                            className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold uppercase tracking-widest text-red-600 hover:bg-red-50"
                            disabled={draft.steps.length === 1}
                          >
                            Remove
                          </button>
                          {step.actionType !== "CHECKLIST" ? (
                            <button
                              type="button"
                              onClick={() => addChecklistItem(index)}
                              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold uppercase tracking-widest text-slate-600 hover:bg-slate-100"
                            >
                              + Checklist Action
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500 md:col-span-2">
                          Title
                          <input
                            value={step.title}
                            onChange={(event) => updateStep(index, { title: event.target.value })}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                            placeholder="Draft discovery request"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                          Action Type
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
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                          >
                            {ACTION_TYPES.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                          Role Scope
                          <select
                            value={step.roleScope}
                            onChange={(event) =>
                              updateStep(index, {
                                roleScope: event.target.value as RoleScope,
                              })
                            }
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                          >
                            {ROLE_SCOPES.map((role) => (
                              <option key={role.value} value={role.value}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                          <input
                            type="checkbox"
                            checked={step.required}
                            onChange={(event) =>
                              updateStep(index, { required: event.target.checked })
                            }
                            className="h-4 w-4 rounded border border-slate-300"
                          />
                          Required
                        </label>
                        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500 md:col-span-2">
                          Action Config (JSON)
                          <textarea
                            value={step.actionConfigInput ?? ""}
                            onChange={(event) =>
                              updateStep(index, { actionConfigInput: event.target.value })
                            }
                            rows={4}
                            className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs focus:border-accent focus:outline-none"
                            placeholder="{ }"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <footer className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitDraft}
                className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-60"
                disabled={saving}
              >
                {saving ? "Saving..." : mode === "create" ? "Create Template" : "Save Changes"}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
