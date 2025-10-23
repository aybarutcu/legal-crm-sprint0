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
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onEdit(task.id, task.itemType || 'TASK')}
                      className="hover:underline font-semibold text-slate-900"
                    >
                      {task.title}
                    </button>
                    {/* Description - skip generic workflow description */}
                    {task.description && task.description !== `${task.actionType} action in workflow` ? (
                      <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                        {task.description}
                      </p>
                    ) : null}
                    {/* Workflow name + role + assignee for workflow steps */}
                    {isWorkflowStep && (
                      <div className="flex items-center gap-2 mt-1">
                        {task.workflowName && (
                          <div className="flex items-center gap-1 text-xs text-blue-600">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span className="font-medium">{task.workflowName}</span>
                          </div>
                        )}
                        {task.roleScope && (
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700">
                            {task.roleScope}
                          </span>
                        )}
                        {task.assignee && (
                          <>
                            <span className="text-slate-400 text-xs">→</span>
                            <div className="flex items-center gap-1 text-xs text-slate-700">
                              <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span className="font-medium">{task.assignee.name}</span>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isWorkflowStep ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-blue-700">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        {task.actionType?.replace(/_/g, " ")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        TASK
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {task.matter ? (
                      <div className="flex items-center gap-1.5">
                        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="font-medium text-slate-700">{task.matter.title}</span>
                      </div>
                    ) : isWorkflowStep && task.contextTitle ? (
                      <div className="flex items-center gap-1.5">
                        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="text-slate-600">{task.contextTitle}</span>
                      </div>
                    ) : (
                      <span className="flex items-center gap-1.5 text-slate-400 italic text-sm">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        Independent
                      </span>
                    )}
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
                    {isWorkflowStep ? (
                      // Workflow steps show assignee as read-only text
                      <div className="px-2 py-1 text-xs text-slate-600">
                        {task.assignee?.name || `Role: ${task.roleScope}`}
                      </div>
                    ) : (
                      // Standalone tasks have editable assignee dropdown
                      <select
                        value={task.assigneeId ?? ""}
                        onChange={(event) =>
                          handleUpdate(task.id, {
                            assigneeId: event.target.value || null,
                          })
                        }
                        disabled={isPending}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 focus:border-accent focus:outline-none"
                      >
                        <option value="">Unassigned</option>
                        {assignees.map((assignee) => (
                          <option key={assignee.id} value={assignee.id}>
                            {assignee.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isWorkflowStep ? (
                      // Workflow steps show priority as read-only text
                      <div className={`px-2 py-1 text-xs font-semibold uppercase ${
                        task.priority === "HIGH" 
                          ? "text-red-600" 
                          : task.priority === "LOW"
                          ? "text-slate-500"
                          : "text-amber-600"
                      }`}>
                        {task.priority || "MEDIUM"}
                      </div>
                    ) : (
                      // Standalone tasks have editable priority dropdown
                      <select
                        value={task.priority}
                        onChange={(event) =>
                          handleUpdate(task.id, { priority: event.target.value })
                        }
                        disabled={isPending}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold uppercase tracking-widest text-slate-600 focus:border-accent focus:outline-none"
                      >
                        {TASK_PRIORITIES.map((priority) => (
                          <option key={priority} value={priority}>
                            {priority}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {isWorkflowStep ? (
                      // Workflow steps show due date as read-only text
                      <div className="px-2 py-1 text-xs text-slate-600">
                        {task.dueAt ? new Date(task.dueAt).toLocaleDateString("tr-TR") : "—"}
                      </div>
                    ) : (
                      // Standalone tasks have editable due date input
                      <>
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
                          disabled={isPending}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 focus:border-accent focus:outline-none"
                        />
                        {task.dueAt ? (
                          <p className="text-[11px] uppercase tracking-widest text-slate-400">
                            {dateFormatter.format(new Date(task.dueAt))}
                          </p>
                        ) : null}
                      </>
                    )}
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