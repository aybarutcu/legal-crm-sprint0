"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskChecklistItem,
  type TaskDetail,
  type TaskPriorityValue,
  type TaskStatusValue,
} from "@/lib/tasks/types";
import type {
  TaskAssigneeOption,
  TaskMatterOption,
} from "@/app/(dashboard)/tasks/_components/use-task-options";

export type TaskFormValues = {
  title: string;
  description: string;
  matterId: string | null;
  assigneeId: string | null;
  dueAt: string | null;
  priority: TaskPriorityValue;
  status: TaskStatusValue;
};

type TaskDialogMode = "create" | "edit";

type TaskDialogProps = {
  mode: TaskDialogMode;
  isOpen: boolean;
  loading?: boolean;
  isReadOnly?: boolean;
  task?: TaskDetail | null;
  assignees: TaskAssigneeOption[];
  matters: TaskMatterOption[];
  onClose: () => void;
  onSubmit: (values: TaskFormValues) => Promise<void>;
  onDelete?: () => Promise<void>;
  onChecklistToggle?: (itemId: string, done: boolean) => Promise<void>;
  onChecklistAdd?: (title: string) => Promise<void>;
  onLinkAdd?: (payload: { url?: string }) => Promise<void>;
  onLinkRemove?: (linkId: string) => Promise<void>;
};

const DEFAULT_VALUES: TaskFormValues = {
  title: "",
  description: "",
  matterId: null,
  assigneeId: null,
  dueAt: null,
  priority: "MEDIUM",
  status: "OPEN",
};

function formatDateInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function normalizeMatterLabel(option: TaskMatterOption) {
  return option.title.length > 48 ? `${option.title.slice(0, 45)}…` : option.title;
}

export function TaskDialog({
  mode,
  isOpen,
  loading,
  isReadOnly,
  task,
  assignees,
  matters,
  onClose,
  onSubmit,
  onDelete,
  onChecklistToggle,
  onChecklistAdd,
  onLinkAdd,
  onLinkRemove,
}: TaskDialogProps) {
  const [formState, setFormState] = useState<TaskFormValues>(DEFAULT_VALUES);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setFormState(DEFAULT_VALUES);
      setError(null);
      setNewChecklistTitle("");
      setNewLinkUrl("");
      return;
    }

    if (mode === "edit" && task) {
      setFormState({
        title: task.title,
        description: task.description ?? "",
        matterId: task.matterId,
        assigneeId: task.assigneeId,
        dueAt: task.dueAt ? formatDateInput(task.dueAt) : null,
        priority: task.priority,
        status: task.status,
      });
    } else {
      setFormState(DEFAULT_VALUES);
    }
  }, [mode, task, isOpen]);

  const assignedAssignee = useMemo(() => {
    if (!formState.assigneeId) return null;
    return assignees.find((item) => item.id === formState.assigneeId) ?? null;
  }, [assignees, formState.assigneeId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isReadOnly) return;
    setError(null);
    setSaving(true);

    try {
      await onSubmit(formState);
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to save task. Please try again.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleChecklistToggle(item: TaskChecklistItem) {
    if (!onChecklistToggle || isReadOnly) return;
    try {
      await onChecklistToggle(item.id, !item.done);
    } catch (err) {
      console.error("Failed to toggle checklist item", err);
    }
  }

  async function handleChecklistAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newChecklistTitle.trim() || !onChecklistAdd || isReadOnly) return;
    try {
      await onChecklistAdd(newChecklistTitle.trim());
      setNewChecklistTitle("");
    } catch (err) {
      console.error("Failed to create checklist item", err);
    }
  }

  async function handleLinkAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newLinkUrl.trim() || !onLinkAdd || isReadOnly) return;
    try {
      await onLinkAdd({ url: newLinkUrl.trim() });
      setNewLinkUrl("");
    } catch (err) {
      console.error("Failed to add task link", err);
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-6 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {mode === "edit" ? "Edit Task" : "New Task"}
            </h3>
            <p className="text-sm text-slate-500">
              {mode === "edit"
                ? "Update task details, checklist items, and links."
                : "Provide high level details, owner, due date and priority."}
            </p>
            {assignedAssignee ? (
              <p className="mt-2 text-xs uppercase tracking-widest text-slate-400">
                Assigned to {assignedAssignee.name}
                {assignedAssignee.email ? ` · ${assignedAssignee.email}` : ""}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {mode === "edit" && onDelete && !isReadOnly ? (
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    try {
                      await onDelete();
                      onClose();
                    } catch (err) {
                      const message =
                        err instanceof Error
                          ? err.message
                          : "Unable to delete task.";
                      setError(message);
                    }
                  })();
                }}
                className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                disabled={saving}
              >
                Delete
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100"
              disabled={saving}
            >
              Close
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
            Loading task details…
          </div>
        ) : (
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                Title
                <input
                  required
                  value={formState.title}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, title: event.target.value }))
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  placeholder="Describe the task"
                  disabled={saving || isReadOnly}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                Description
                <textarea
                  value={formState.description}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  rows={4}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  placeholder="Add context or acceptance criteria"
                  disabled={saving || isReadOnly}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Matter
                <select
                  value={formState.matterId ?? ""}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      matterId: event.target.value || null,
                    }))
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  disabled={saving || isReadOnly}
                >
                  <option value="">Unassigned</option>
                  {matters.map((matter) => (
                    <option key={matter.id} value={matter.id}>
                      {normalizeMatterLabel(matter)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Assignee
                <select
                  value={formState.assigneeId ?? ""}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      assigneeId: event.target.value || null,
                    }))
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  disabled={saving || isReadOnly}
                >
                  <option value="">Unassigned</option>
                  {assignees.map((assignee) => (
                    <option key={assignee.id} value={assignee.id}>
                      {assignee.name}
                      {assignee.email ? ` (${assignee.email})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Due Date
                <input
                  type="date"
                  value={formatDateInput(formState.dueAt)}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      dueAt: event.target.value ? event.target.value : null,
                    }))
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  disabled={saving || isReadOnly}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Priority
                <select
                  value={formState.priority}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      priority: event.target.value as TaskPriorityValue,
                    }))
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  disabled={saving || isReadOnly}
                >
                  {TASK_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Status
                <select
                  value={formState.status}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      status: event.target.value as TaskStatusValue,
                    }))
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  disabled={mode === "create" || saving || isReadOnly}
                >
                  {TASK_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error ? (
              <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
                {error}
              </p>
            ) : null}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                disabled={saving}
              >
                Cancel
              </button>
              {!isReadOnly && <button
                type="submit"
                className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-60"
                disabled={saving}
              >
                {saving
                  ? "Saving…"
                  : mode === "edit"
                    ? "Save Changes"
                    : "Create Task"}
              </button>}
            </div>
          </form>
        )}

        {mode === "edit" && task ? (
          <section className="space-y-6">
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
                Checklist
              </h4>
              <div className="mt-3 space-y-2">
                {task.checklists.length === 0 ? (
                  <p className="text-sm text-slate-500">No checklist items yet.</p>
                ) : (
                  task.checklists.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-start gap-3 rounded-xl border border-slate-200 px-4 py-3"
                    >
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => handleChecklistToggle(item)}
                        className="mt-1 h-4 w-4 rounded border-slate-300"
                        disabled={saving || isReadOnly}
                      />
                      <div>
                        <p className={`text-sm ${item.done ? "text-slate-400 line-through" : "text-slate-700"}`}>
                          {item.title}
                        </p>
                        <p className="text-xs uppercase tracking-widest text-slate-400">
                          Last updated {new Date(item.updatedAt).toLocaleString("tr-TR")}
                        </p>
                      </div>
                    </label>
                  ))
                )}

                {onChecklistAdd && !isReadOnly ? (
                  <form className="flex items-center gap-2" onSubmit={handleChecklistAdd}>
                    <input
                      value={newChecklistTitle}
                      onChange={(event) => setNewChecklistTitle(event.target.value)}
                      placeholder="Add checklist item"
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                      disabled={saving || isReadOnly}
                    />
                    <button
                      type="submit"
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-slate-600 hover:bg-slate-100"
                      disabled={saving || isReadOnly}
                    >
                      Add
                    </button>
                  </form>
                ) : null}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
                Links
              </h4>
              <div className="mt-3 space-y-2">
                {task.links.length === 0 ? (
                  <p className="text-sm text-slate-500">No linked resources yet.</p>
                ) : (
                  task.links.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600"
                    >
                      <div className="flex flex-col">
                        {link.url ? (
                          <>
                            <span className="font-medium text-slate-800">External URL</span>
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-accent underline"
                            >
                              {link.url}
                            </a>
                          </>
                        ) : (
                          <span>
                            Linked resource:
                            {link.documentId ? ` Document ${link.documentId}` : ""}
                            {link.eventId ? ` Event ${link.eventId}` : ""}
                          </span>
                        )}
                      </div>
                      {onLinkRemove && !isReadOnly ? (
                        <button
                          type="button"
                          onClick={() => {
                            void onLinkRemove(link.id);
                          }}
                          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-500 hover:bg-slate-100"
                          disabled={saving || isReadOnly}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  ))
                )}

                {onLinkAdd && !isReadOnly ? (
                  <form className="flex items-center gap-2" onSubmit={handleLinkAdd}>
                    <input
                      value={newLinkUrl}
                      onChange={(event) => setNewLinkUrl(event.target.value)}
                      placeholder="https://"
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                      disabled={saving || isReadOnly}
                    />
                    <button
                      type="submit"
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-slate-600 hover:bg-slate-100"
                      disabled={saving || isReadOnly}
                    >
                      Link URL
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}