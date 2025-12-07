"use client";

import type { AutomationActionData } from "@/lib/workflows/automation/types";
import { CheckCircle2, AlertTriangle, Clock, Loader2 } from "lucide-react";

type AutomationExecutionProps = {
  step: {
    id: string;
    title: string;
    actionData: Record<string, unknown> | null;
  };
  onComplete: (payload?: unknown) => void;
  onFail: (reason: string) => void;
  isCompleting: boolean;
  isFailing: boolean;
};

const STATUS_META: Record<
  NonNullable<AutomationActionData["status"]>,
  { label: string; className: string; icon: React.ReactNode }
> = {
  PENDING: { label: "Pending", className: "bg-slate-100 text-slate-700", icon: <Clock className="h-4 w-4" /> },
  QUEUED: { label: "Queued", className: "bg-blue-100 text-blue-700", icon: <Clock className="h-4 w-4" /> },
  IN_PROGRESS: { label: "In Progress", className: "bg-amber-100 text-amber-700", icon: <Loader2 className="h-4 w-4 animate-spin" /> },
  SUCCEEDED: { label: "Completed", className: "bg-emerald-100 text-emerald-700", icon: <CheckCircle2 className="h-4 w-4" /> },
  FAILED: { label: "Failed", className: "bg-rose-100 text-rose-700", icon: <AlertTriangle className="h-4 w-4" /> },
  MANUAL_OVERRIDE: { label: "Manual Override", className: "bg-indigo-100 text-indigo-700", icon: <CheckCircle2 className="h-4 w-4" /> },
};

function parseAutomationData(actionData: Record<string, unknown> | null): AutomationActionData {
  if (!actionData || typeof actionData !== "object") {
    return {};
  }
  const data = actionData as AutomationActionData;
  return {
    status: data.status,
    runs: data.runs,
    lastQueuedAt: data.lastQueuedAt,
    lastExecutionAt: data.lastExecutionAt,
    lastCompletedAt: data.lastCompletedAt,
    lastError: data.lastError,
    lastResult: data.lastResult,
    logs: Array.isArray(data.logs) ? data.logs : [],
  };
}

export function AutomationExecution({ step, onComplete, onFail, isCompleting, isFailing }: AutomationExecutionProps) {
  const automationData = parseAutomationData(step.actionData);
  const statusMeta = automationData.status ? STATUS_META[automationData.status] : STATUS_META.PENDING;

  const handleManualComplete = () => {
    const message = window.prompt("Optional note for completion:") ?? undefined;
    onComplete({
      status: "MANUAL_OVERRIDE",
      message: message?.trim() || undefined,
    });
  };

  const handleFail = () => {
    const reason = window.prompt("Reason for failure?");
    if (reason) {
      onFail(reason);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.className}`}>
              {statusMeta.icon}
              <span>{statusMeta.label}</span>
            </div>
            {automationData.runs && (
              <span className="text-xs text-slate-500">Attempts: {automationData.runs}</span>
            )}
          </div>
          <div className="text-[11px] text-slate-500">
            {automationData.lastQueuedAt && (
              <div>Queued: {new Date(automationData.lastQueuedAt).toLocaleString()}</div>
            )}
            {automationData.lastCompletedAt && (
              <div>Completed: {new Date(automationData.lastCompletedAt).toLocaleString()}</div>
            )}
          </div>
        </div>

        {automationData.lastError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <strong>Error:</strong> {automationData.lastError}
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-600 uppercase mb-2">Automation Logs</p>
          {automationData.logs && automationData.logs.length > 0 ? (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {automationData.logs.map((log, idx) => (
                <div key={`${log.at}-${idx}`} className="text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{new Date(log.at).toLocaleString()}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        log.level === "ERROR"
                          ? "bg-rose-100 text-rose-700"
                          : log.level === "WARN"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {log.level ?? "INFO"}
                    </span>
                  </div>
                  <div className="pl-2 text-slate-600">{log.message}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">No automation activity yet</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={handleManualComplete}
          disabled={isCompleting}
          className="flex-1 rounded-lg border-2 border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
        >
          {isCompleting ? "Completing..." : "Mark as Completed"}
        </button>
        <button
          type="button"
          onClick={handleFail}
          disabled={isFailing}
          className="flex-1 rounded-lg border-2 border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
        >
          {isFailing ? "Failing..." : "Mark as Failed"}
        </button>
      </div>
    </div>
  );
}
