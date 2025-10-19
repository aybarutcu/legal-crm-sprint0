"use client";

import { useMemo, useState } from "react";
import { TASK_PRIORITIES, TASK_STATUSES, type TaskListItem } from "@/lib/tasks/types";
import type { TaskAssigneeOption } from "./use-task-options";

type TaskListViewProps = {
  tasks: TaskListItem[];
  assignees: TaskAssigneeOption[];
  isLoading: boolean;
  onEdit: (taskId: string, itemType: 'TASK' | 'WORKFLOW_STEP') => void;
  onUpdateTask: (taskId: string, payload: Partial<{ status: string; assigneeId: string | null; dueAt: Date | null; priority: string }>) => Promise<void>;
};

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
});

function toDateInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function TaskListView({
  tasks,
  assignees,
  isLoading,
  onEdit,
  onUpdateTask,
}: TaskListViewProps) {
  const [pendingIds, setPendingIds] = useState<string[]>([]);

  const pendingSet = useMemo(() => new Set(pendingIds), [pendingIds]);

  const handleUpdate = async (
    taskId: string,
    payload: Parameters<typeof onUpdateTask>[1],
  ) => {
    if (pendingSet.has(taskId)) return;
    setPendingIds((prev) => (prev.includes(taskId) ? prev : [...prev, taskId]));
    try {
      await onUpdateTask(taskId, payload);
    } finally {
      setPendingIds((prev) => prev.filter((id) => id !== taskId));
    }
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
      <table className="w-full table-auto text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
          <tr>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Matter</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Assignee</th>
            <th className="px-4 py-3">Priority</th>
            <th className="px-4 py-3">Due</th>
            <th className="px-4 py-3">Checklist</th>
            <th className="px-4 py-3">Links</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={10} className="px-4 py-6 text-center text-sm text-slate-500">
                Loading tasks…
              </td>
            </tr>
          ) : tasks.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-6 text-center text-sm text-slate-500">
                No tasks match your filters.
              </td>
            </tr>
          ) : (
            tasks.map((task) => {
              const isPending = pendingSet.has(task.id);
              const isWorkflowStep = task.itemType === 'WORKFLOW_STEP';
              return (
                <tr
                  key={task.id}
                  data-testid={`task-card-${task.id}`}
                  className="border-b border-slate-100 last:border-none hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <button
                      type="button"
                      onClick={() => onEdit(task.id, task.itemType || 'TASK')}
                      className="hover:underline"
                    >
                      {task.title}
                    </button>
                    {task.description ? (
                      <p className="text-xs text-slate-500 line-clamp-2">
                        {task.description}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {isWorkflowStep ? (
                      <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-blue-600">
                        {task.actionType?.replace(/_/g, " ")}
                      </span>
                    ) : (
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-green-600">
                        Task
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {task.matter?.title ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={task.status}
                      onChange={(event) =>
                        handleUpdate(task.id, { status: event.target.value })
                      }
                      disabled={isPending || isWorkflowStep}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold uppercase tracking-widest text-slate-600 focus:border-accent focus:outline-none"
                    >
                      {TASK_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={task.assigneeId ?? ""}
                      onChange={(event) =>
                        handleUpdate(task.id, {
                          assigneeId: event.target.value || null,
                        })
                      }
                      disabled={isPending || isWorkflowStep}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 focus:border-accent focus:outline-none"
                    >
                      <option value="">Unassigned</option>
                      {assignees.map((assignee) => (
                        <option key={assignee.id} value={assignee.id}>
                          {assignee.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={task.priority}
                      onChange={(event) =>
                        handleUpdate(task.id, { priority: event.target.value })
                      }
                      disabled={isPending || isWorkflowStep}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold uppercase tracking-widest text-slate-600 focus:border-accent focus:outline-none"
                    >
                      {TASK_PRIORITIES.map((priority) => (
                        <option key={priority} value={priority}>
                          {priority}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <input
                      type="date"
                      value={toDateInput(task.dueAt)}
                      onChange={(event) =>
                        handleUpdate(task.id, {
                          dueAt: event.target.value
                            ? new Date(event.target.value)
                            : null,
                        })
                      }
                      disabled={isPending || isWorkflowStep}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 focus:border-accent focus:outline-none"
                    />
                    {task.dueAt ? (
                      <p className="text-[11px] uppercase tracking-widest text-slate-400">
                        {dateFormatter.format(new Date(task.dueAt))}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{task._count.checklists}</td>
                  <td className="px-4 py-3 text-slate-600">{task._count.links}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onEdit(task.id, task.itemType || 'TASK')}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-slate-600 hover:bg-slate-100"
                    >
                      View
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}