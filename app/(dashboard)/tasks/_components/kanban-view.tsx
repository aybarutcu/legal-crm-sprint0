"use client";

import { useMemo, useState, type DragEvent } from "react";
import type { TaskListItem } from "@/lib/tasks/types";

type KanbanViewProps = {
  tasks: TaskListItem[];
  isLoading?: boolean;
  onSelectTask?: (taskId: string, itemType: 'TASK' | 'WORKFLOW_STEP') => void;
  onMoveTask?: (
    taskId: string,
    status: TaskListItem["status"],
  ) => Promise<void> | void;
};

const COLUMNS: Array<{
  key: TaskListItem["status"];
  title: string;
  description: string;
}> = [
  { key: "OPEN", title: "Open", description: "Newly created tasks" },
  { key: "IN_PROGRESS", title: "In Progress", description: "Actively being worked on" },
  { key: "DONE", title: "Done", description: "Completed tasks" },
  { key: "CANCELED", title: "Canceled", description: "Dropped or canceled" },
];

export function KanbanView({ tasks, isLoading, onSelectTask, onMoveTask }: KanbanViewProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskListItem["status"] | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<TaskListItem["status"], TaskListItem[]>();
    COLUMNS.forEach((column) => {
      map.set(column.key, []);
    });

    tasks.forEach((task) => {
      const list = map.get(task.status);
      if (list) {
        list.push(task);
      }
    });

    return map;
  }, [tasks]);

  function handleDragStart(event: DragEvent<unknown>, taskId: string) {
    setDraggingId(taskId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", taskId);
  }

  function handleDragOver(event: DragEvent<unknown>, status: TaskListItem["status"]) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTarget(status);
  }

  async function handleDrop(status: TaskListItem["status"]) {
    if (!draggingId) {
      setDropTarget(null);
      return;
    }

    setDropTarget(null);
    const task = tasks.find((item) => item.id === draggingId);
    if (!task || task.status === status) {
      setDraggingId(null);
      return;
    }

    try {
      await onMoveTask?.(draggingId, status);
    } catch (error) {
      console.error("Failed to move task", error);
    } finally {
      setDraggingId(null);
    }
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDropTarget(null);
  }

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {COLUMNS.map((column) => {
        const columnTasks = grouped.get(column.key) ?? [];
        return (
          <article
            key={column.key}
            className={`flex min-h-[240px] flex-col gap-3 rounded-2xl border bg-white p-6 shadow-card transition ${
              dropTarget === column.key ? "border-accent bg-accent/5" : "border-slate-200"
            }`}
            onDragOver={(event) => handleDragOver(event, column.key)}
            onDrop={() => handleDrop(column.key)}
          >
            <header>
              <h3 className="text-lg font-semibold text-slate-900">{column.title}</h3>
              <p className="text-xs uppercase tracking-widest text-slate-400">
                {column.description}
              </p>
            </header>
            <div className="space-y-3">
              {isLoading ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-14 rounded-xl bg-slate-100" />
                  <div className="h-14 rounded-xl bg-slate-100" />
                </div>
              ) : columnTasks.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-400">
                  No tasks
                </p>
              ) : (
                columnTasks.map((task) => {
                  const isWorkflowStep = task.itemType === 'WORKFLOW_STEP';
                  return (
                    <button
                      key={task.id}
                      data-testid={`task-card-${task.id}`}
                      type="button"
                      onClick={() => onSelectTask?.(task.id, task.itemType || 'TASK')}
                      draggable={!isWorkflowStep}
                      onDragStart={(event) => handleDragStart(event, task.id)}
                      onDragEnd={handleDragEnd}
                      className={`w-full rounded-xl border px-4 py-3 text-left shadow-sm transition hover:shadow-md ${
                        draggingId === task.id 
                          ? "border-blue-400 bg-blue-50" 
                          : isWorkflowStep
                          ? "border-blue-200 bg-gradient-to-br from-blue-50 to-white hover:border-blue-300"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      {/* Header with Title and Badge */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-semibold text-slate-900 flex-1 line-clamp-2">{task.title}</h4>
                        {isWorkflowStep ? (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 whitespace-nowrap">
                            {task.actionType?.replace(/_/g, " ")}
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 whitespace-nowrap">
                            TASK
                          </span>
                        )}
                      </div>

                      {/* Matter/Context Badge */}
                      {task.matter ? (
                        <div className="mb-2 flex items-center gap-1.5 text-xs">
                          <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="font-medium text-slate-700 truncate">{task.matter.title}</span>
                        </div>
                      ) : isWorkflowStep && task.contextTitle ? (
                        <div className="mb-2 flex items-center gap-1.5 text-xs">
                          <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span className="font-medium text-slate-700 truncate">{task.contextTitle}</span>
                        </div>
                      ) : (
                        <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-500 italic">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                          </svg>
                          <span>Independent task</span>
                        </div>
                      )}

                      {/* Workflow Name (if workflow step) */}
                      {isWorkflowStep && task.workflowName && (
                        <div className="mb-2 flex items-center gap-1.5 text-xs text-blue-600">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span className="font-medium truncate">{task.workflowName}</span>
                        </div>
                      )}

                      {/* Role Scope + Direct Assignment (if workflow step) */}
                      {isWorkflowStep && (
                        <div className="mb-2 flex items-center gap-2 text-xs">
                          <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700">
                            {task.roleScope}
                          </span>
                          {task.assignee && (
                            <>
                              <span className="text-slate-400">→</span>
                              <div className="flex items-center gap-1 text-slate-700">
                                <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <span className="font-medium">{task.assignee.name}</span>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* Description */}
                      {task.description && task.description !== `${task.actionType} action in workflow` ? (
                        <p className="mt-2 text-xs text-slate-600 line-clamp-2">
                          {task.description}
                        </p>
                      ) : null}

                      {/* Footer Metadata */}
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 border-t border-slate-100 pt-2">
                        {task.dueAt ? (
                          <span className="flex items-center gap-1">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {new Date(task.dueAt).toLocaleDateString("tr-TR")}
                          </span>
                        ) : null}
                        {/* Show assignee only for standalone tasks (workflow steps show it above) */}
                        {!isWorkflowStep && task.assignee?.name ? (
                          <span className="flex items-center gap-1">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {task.assignee.name}
                          </span>
                        ) : null}
                        {/* Priority badge - always show */}
                        {task.priority ? (
                          <span className={`flex items-center gap-1 font-semibold ${
                            task.priority === "HIGH" 
                              ? "text-red-600" 
                              : task.priority === "LOW" 
                              ? "text-slate-500"
                              : "text-amber-600"
                          }`}>
                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                            </svg>
                            {task.priority}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}