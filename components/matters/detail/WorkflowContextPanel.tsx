"use client";

import { useState } from "react";
import { useWorkflowContext } from "./hooks/useWorkflowContext";
import { ContextEditModal } from "./ContextEditModal";

type WorkflowContextPanelProps = {
  instanceId: string;
};

function getTypeDisplay(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function getValueDisplay(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function getTypeBadgeClass(type: string): string {
  switch (type) {
    case "string":
      return "bg-blue-100 text-blue-700";
    case "number":
      return "bg-green-100 text-green-700";
    case "boolean":
      return "bg-purple-100 text-purple-700";
    case "array":
      return "bg-amber-100 text-amber-700";
    case "object":
      return "bg-pink-100 text-pink-700";
    case "null":
      return "bg-slate-100 text-slate-500";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export function WorkflowContextPanel({ instanceId }: WorkflowContextPanelProps) {
  const { context, schema, loading, error, updateContext, deleteKey, clearContext, reload } =
    useWorkflowContext(instanceId);

  const [isExpanded, setIsExpanded] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | undefined>();
  const [editingValue, setEditingValue] = useState<unknown>();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }

  function openAddModal() {
    setEditingKey(undefined);
    setEditingValue(undefined);
    setEditModalOpen(true);
  }

  function openEditModal(key: string, value: unknown) {
    setEditingKey(key);
    setEditingValue(value);
    setEditModalOpen(true);
  }

  async function handleSave(key: string, value: unknown) {
    try {
      await updateContext({ [key]: value }, "merge");
      showToast("success", `Context value "${key}" saved successfully`);
    } catch (err) {
      showToast("error", `Failed to save context value: ${err instanceof Error ? err.message : "Unknown error"}`);
      throw err;
    }
  }

  async function handleDelete(key: string) {
    if (!window.confirm(`Are you sure you want to delete context key "${key}"?`)) {
      return;
    }

    try {
      setActionLoading(`delete-${key}`);
      await deleteKey(key);
      showToast("success", `Context key "${key}" deleted successfully`);
    } catch (err) {
      showToast("error", `Failed to delete context key: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleClearAll() {
    if (!window.confirm("Are you sure you want to clear all context data? This cannot be undone.")) {
      return;
    }

    try {
      setActionLoading("clear-all");
      await clearContext();
      showToast("success", "All context data cleared successfully");
    } catch (err) {
      showToast("error", `Failed to clear context: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleExport() {
    if (!context) return;
    
    const dataStr = JSON.stringify(context, null, 2);
    const blob = new window.Blob([dataStr], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `workflow-context-${instanceId}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    showToast("success", "Context exported successfully");
  }

  const contextEntries = context ? Object.entries(context) : [];
  const isEmpty = contextEntries.length === 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-semibold text-slate-900 hover:text-accent"
        >
          <span className="text-lg">{isExpanded ? "▼" : "▶"}</span>
          <span>Workflow Context</span>
          {!loading && (
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {contextEntries.length} {contextEntries.length === 1 ? "key" : "keys"}
            </span>
          )}
        </button>
        
        <div className="flex gap-2">
          {isExpanded && !isEmpty && (
            <>
              <button
                type="button"
                onClick={handleExport}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                title="Export context as JSON"
              >
                Export
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                disabled={actionLoading === "clear-all"}
                className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                {actionLoading === "clear-all" ? "Clearing..." : "Clear All"}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={openAddModal}
            className="rounded-lg border border-accent bg-accent px-3 py-1 text-xs font-semibold text-white hover:bg-accent/90"
          >
            + Add
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
              <span className="ml-2 text-sm text-slate-500">Loading context...</span>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <div className="font-semibold">Error loading context</div>
              <div className="mt-1">{error.message}</div>
              <button
                type="button"
                onClick={() => reload()}
                className="mt-2 text-xs underline hover:no-underline"
              >
                Try again
              </button>
            </div>
          ) : isEmpty ? (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center">
              <div className="text-sm font-medium text-slate-600">No context data yet</div>
              <div className="mt-1 text-xs text-slate-500">
                Add key-value pairs to share data between workflow steps
              </div>
              <button
                type="button"
                onClick={openAddModal}
                className="mt-3 rounded-lg border border-accent bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
              >
                Add First Value
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {contextEntries.map(([key, value]) => {
                const type = getTypeDisplay(value);
                const isDeleting = actionLoading === `delete-${key}`;
                
                return (
                  <div
                    key={key}
                    className="rounded-lg border border-slate-200 bg-white p-3 transition-all hover:border-slate-300"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                            {key}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getTypeBadgeClass(type)}`}
                          >
                            {type}
                          </span>
                        </div>
                        
                        <div className="mt-2">
                          {typeof value === "object" && value !== null ? (
                            <pre className="max-h-40 overflow-auto rounded bg-slate-50 px-2 py-1 text-xs font-mono text-slate-700">
                              {getValueDisplay(value)}
                            </pre>
                          ) : (
                            <div className="text-sm text-slate-900 break-words">
                              {getValueDisplay(value)}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(key, value)}
                          className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                          title="Edit value"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(key)}
                          disabled={isDeleting}
                          className="rounded border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                          title="Delete key"
                        >
                          {isDeleting ? "..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <ContextEditModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSave={handleSave}
        existingKey={editingKey}
        existingValue={editingValue}
        schema={schema}
      />

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-lg px-4 py-3 text-sm shadow-lg ${
            toast.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
