"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type CreateTaskPayload,
  type TaskDetail,
  type UpdateTaskPayload,
} from "@/lib/tasks/types";
import {
  type TaskFilterState,
  type TaskQueryState,
  useTasksData,
} from "./use-tasks-data";
import { useTaskOptions } from "./use-task-options";
import { KanbanView } from "./kanban-view";
import { TaskListView } from "./task-list-view";
import { TaskDialog, type TaskFormValues } from "@/components/tasks/TaskDialog";
import { getTask } from "@/lib/tasks/client";

type TaskViewMode = "list" | "kanban";

type DialogState =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; taskId: string; itemType: 'TASK' | 'WORKFLOW_STEP' };

type ToastState = {
  message: string;
  variant: "success" | "error";
};

const DEFAULT_QUERY_STATE: TaskQueryState = {
  tab: "all",
  page: 1,
  pageSize: 20,
  filters: {},
};

function toDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function toCreatePayload(values: TaskFormValues): CreateTaskPayload {
  return {
    title: values.title.trim(),
    description: values.description.trim() || undefined,
    matterId: values.matterId,
    assigneeId: values.assigneeId,
    dueAt: toDate(values.dueAt),
    priority: values.priority,
    status: values.status,
  };
}

function toUpdatePayload(values: TaskFormValues): UpdateTaskPayload {
  return {
    title: values.title.trim(),
    description: values.description.trim() || null,
    matterId: values.matterId,
    assigneeId: values.assigneeId,
    dueAt: toDate(values.dueAt),
    priority: values.priority,
    status: values.status,
  };
}

type TasksClientProps = {
  currentUserId?: string;
};

export function TasksClient({ currentUserId }: TasksClientProps) {
  const [view, setView] = useState<TaskViewMode>("kanban");
  const [queryState, setQueryState] = useState<TaskQueryState>(DEFAULT_QUERY_STATE);
  const [dialogState, setDialogState] = useState<DialogState>({ open: false });
  const [dialogTask, setDialogTask] = useState<TaskDetail | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const { assignees, matters, isLoading: optionsLoading } = useTaskOptions();

  const {
    data: tasks,
    meta,
    isLoading,
    isValidating,
    error,
    createTask,
    updateTask,
    deleteTask,
    createChecklist,
    updateChecklist,
    createLink,
    deleteLink,
  } = useTasksData({
    state: queryState,
    currentUserId,
  });

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const activeFilters = useMemo<TaskFilterState>(
    () => queryState.filters,
    [queryState.filters],
  );

  function handleTabChange(tab: TaskQueryState["tab"]) {
    setQueryState((prev) => ({
      ...prev,
      tab,
      page: 1,
    }));
  }

  function handleViewChange(mode: TaskViewMode) {
    setView(mode);
  }

  function resetFilters() {
    setQueryState((prev) => ({
      ...prev,
      page: 1,
      filters: {},
    }));
  }

  function updateFilters(patch: Partial<TaskFilterState>) {
    setQueryState((prev) => ({
      ...prev,
      page: 1,
      filters: {
        ...prev.filters,
        ...patch,
      },
    }));
  }

  function closeDialog() {
    setDialogState({ open: false });
    setDialogTask(null);
    setDialogLoading(false);
  }

  function showToast(message: string, variant: ToastState["variant"]) {
    setToast({ message, variant });
  }

  async function openEditDialog(taskId: string, itemType: 'TASK' | 'WORKFLOW_STEP') {
    setDialogState({ open: true, mode: "edit", taskId, itemType });
    setDialogLoading(true);
    try {
      const detail = await getTask(taskId);
      setDialogTask(detail);
    } catch (err) {
      console.error(err);
      showToast(
        err instanceof Error ? err.message : "Unable to load task details.",
        "error",
      );
      setDialogState({ open: false });
    } finally {
      setDialogLoading(false);
    }
  }

  async function handleCreate(values: TaskFormValues) {
    await createTask(toCreatePayload(values));
    showToast("Task created successfully.", "success");
  }

  async function handleUpdate(values: TaskFormValues, taskId: string) {
    await updateTask(taskId, toUpdatePayload(values));
    showToast("Task updated.", "success");
    await refreshTaskDetail(taskId);
  }

  async function handleDelete(taskId: string) {
    await deleteTask(taskId);
    showToast("Task deleted.", "success");
  }

  async function refreshTaskDetail(taskId: string) {
    if (dialogState.open && dialogState.mode === "edit" && dialogState.taskId === taskId) {
      try {
        const detail = await getTask(taskId);
        setDialogTask(detail);
      } catch (error) {
        console.error("Failed to refresh task detail", error);
      }
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "mine", "overdue", "upcoming"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabChange(tab)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                queryState.tab === tab
                  ? "bg-accent text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab === "all"
                ? "All"
                : tab === "mine"
                  ? "My Tasks"
                  : tab === "overdue"
                    ? "Overdue"
                    : "Upcoming"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleViewChange("list")}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              view === "list"
                ? "border-accent bg-accent/10 text-accent"
                : "border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => handleViewChange("kanban")}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              view === "kanban"
                ? "border-accent bg-accent/10 text-accent"
                : "border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            Kanban
          </button>
          <button
            type="button"
            onClick={() => setDialogState({ open: true, mode: "create" })}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent/90"
          >
            New Task
          </button>
        </div>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <form
          className="grid gap-3 md:grid-cols-6"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new window.FormData(event.currentTarget);
            updateFilters({
              q: (formData.get("q") as string) || undefined,
              matterId: (formData.get("matterId") as string) || undefined,
              assigneeId: (formData.get("assigneeId") as string) || undefined,
              status:
                ((formData.get("status") as TaskFilterState["status"]) || "ALL") ??
                "ALL",
              priority:
                ((formData.get("priority") as TaskFilterState["priority"]) || "ALL") ??
                "ALL",
              dueFrom: (formData.get("dueFrom") as string) || undefined,
              dueTo: (formData.get("dueTo") as string) || undefined,
            });
          }}
        >
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500 md:col-span-2">
            Search
            <input
              name="q"
              defaultValue={activeFilters.q ?? ""}
              placeholder="Title or description"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
              type="search"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Matter
            <select
              name="matterId"
              defaultValue={activeFilters.matterId ?? ""}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
            >
              <option value="">All</option>
              {matters.map((matter) => (
                <option key={matter.id} value={matter.id}>
                  {matter.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Assignee
            <select
              name="assigneeId"
              defaultValue={activeFilters.assigneeId ?? ""}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
            >
              <option value="">All</option>
              {assignees.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Status
            <select
              name="status"
              defaultValue={activeFilters.status ?? "ALL"}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
            >
              <option value="ALL">All</option>
              {TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replace("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Priority
            <select
              name="priority"
              defaultValue={activeFilters.priority ?? "ALL"}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
            >
              <option value="ALL">All</option>
              {TASK_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Due from
            <input
              type="date"
              name="dueFrom"
              defaultValue={activeFilters.dueFrom ?? ""}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Due to
            <input
              type="date"
              name="dueTo"
              defaultValue={activeFilters.dueTo ?? ""}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
            />
          </label>

          <div className="flex items-end gap-3 md:col-span-2">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {toast ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            toast.variant === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error.message}
        </div>
      ) : null}

      {view === "kanban" ? (
        <KanbanView
          tasks={tasks}
          isLoading={isLoading}
          onSelectTask={(taskId, itemType) => openEditDialog(taskId, itemType)}
          onMoveTask={async (taskId, status) => {
            await updateTask(taskId, { status });
          }}
        />
      ) : (
        <TaskListView
          tasks={tasks}
          assignees={assignees}
          isLoading={isLoading}
          onEdit={(taskId, itemType) => openEditDialog(taskId, itemType)}
          onUpdateTask={async (taskId, payload) => {
            const normalized: UpdateTaskPayload = {};
            if ("status" in payload && typeof payload.status === "string") {
              normalized.status = payload.status as UpdateTaskPayload["status"];
            }
            if ("assigneeId" in payload) {
              normalized.assigneeId = payload.assigneeId ?? null;
            }
            if ("priority" in payload && typeof payload.priority === "string") {
              normalized.priority = payload.priority as UpdateTaskPayload["priority"];
            }
            if ("dueAt" in payload) {
              normalized.dueAt =
                payload.dueAt instanceof Date
                  ? payload.dueAt
                  : payload.dueAt === null
                    ? null
                    : payload.dueAt;
            }
            await updateTask(taskId, normalized);
            showToast("Task updated.", "success");
            await refreshTaskDetail(taskId);
          }}
        />
      )}

      <footer className="flex items-center justify-between text-sm text-slate-500">
        <div>
          Showing {(meta.page - 1) * meta.pageSize + 1}-
          {Math.min(meta.page * meta.pageSize, meta.total)} of {meta.total}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setQueryState((prev) => ({
                ...prev,
                page: Math.max(1, prev.page - 1),
              }))
            }
            disabled={meta.page <= 1 || isLoading || isValidating}
            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-600 disabled:opacity-60"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() =>
              setQueryState((prev) => ({
                ...prev,
                page: prev.page + 1,
              }))
            }
            disabled={meta.page * meta.pageSize >= meta.total || isLoading || isValidating}
            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-600 disabled:opacity-60"
          >
            Next
          </button>
        </div>
      </footer>

      <TaskDialog
        mode={
          dialogState.open && dialogState.mode === "edit"
            ? "edit"
            : "create"
        }
        isOpen={dialogState.open}
        loading={dialogLoading || optionsLoading}
        task={dialogTask}
        assignees={assignees}
        matters={matters}
        onClose={closeDialog}
        isReadOnly={dialogState.open && dialogState.mode === 'edit' && dialogState.itemType === 'WORKFLOW_STEP'}
        onSubmit={async (values) => {
          if (dialogState.open && dialogState.mode === "edit") {
            await handleUpdate(values, dialogState.taskId);
          } else {
            await handleCreate(values);
          }
        }}
        onDelete={
          dialogState.open && dialogState.mode === "edit"
            ? async () => {
                await handleDelete(dialogState.taskId);
              }
            : undefined
        }
        onChecklistToggle={
          dialogState.open && dialogState.mode === "edit"
            ? async (checklistId, done) => {
                await updateChecklist(checklistId, { done });
                await refreshTaskDetail(dialogState.taskId);
              }
            : undefined
        }
        onChecklistAdd={
          dialogState.open && dialogState.mode === "edit"
            ? async (title) => {
                await createChecklist(dialogState.taskId, { title });
                await refreshTaskDetail(dialogState.taskId);
              }
            : undefined
        }
        onLinkAdd={
          dialogState.open && dialogState.mode === "edit"
            ? async (payload) => {
                await createLink(dialogState.taskId, payload);
                await refreshTaskDetail(dialogState.taskId);
              }
            : undefined
        }
        onLinkRemove={
          dialogState.open && dialogState.mode === "edit"
            ? async (linkId) => {
                await deleteLink(linkId);
                await refreshTaskDetail(dialogState.taskId);
              }
            : undefined
        }
      />
    </section>
  );
}