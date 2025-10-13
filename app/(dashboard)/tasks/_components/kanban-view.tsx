"use client";

import { useMemo, useState, type DragEvent } from "react";
import type { TaskListItem } from "@/lib/tasks/types";

type KanbanViewProps = {
  tasks: TaskListItem[];
  isLoading?: boolean;
  onSelectTask?: (taskId: string) => void;
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
                columnTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onSelectTask?.(task.id)}
                    draggable
                    onDragStart={(event) => handleDragStart(event, task.id)}
                    onDragEnd={handleDragEnd}
                    className={`w-full rounded-xl border px-4 py-3 text-left text-sm text-slate-700 shadow-sm transition hover:border-accent/40 hover:bg-slate-100 ${
                      draggingId === task.id ? "border-accent bg-accent/10" : "border-slate-100 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-slate-900">{task.title}</h4>
                      {task.priority !== "MEDIUM" ? (
                        <span className="text-xs font-semibold uppercase tracking-widest text-accent">
                          {task.priority}
                        </span>
                      ) : null}
                    </div>
                    {task.description ? (
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                        {task.description}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-widest text-slate-400">
                      {task.dueAt ? (
                        <span>
                          Due {new Date(task.dueAt).toLocaleDateString("tr-TR")}
                        </span>
                      ) : (
                        <span>No due date</span>
                      )}
                      {task.assignee?.name ? <span>• {task.assignee.name}</span> : null}
                    </div>
                  </button>
                ))
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
