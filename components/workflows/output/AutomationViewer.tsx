"use client";

import type { AutomationActionData } from "@/lib/workflows/automation/types";

type AutomationViewerProps = {
  data: AutomationActionData | null;
};

const STATUS_LABELS: Record<NonNullable<AutomationActionData["status"]>, string> = {
  PENDING: "Pending",
  QUEUED: "Queued",
  IN_PROGRESS: "In Progress",
  SUCCEEDED: "Completed",
  FAILED: "Failed",
  MANUAL_OVERRIDE: "Manual Override",
};

export function AutomationViewer({ data }: AutomationViewerProps) {
  if (!data) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
        No automation metadata recorded.
      </div>
    );
  }

  const status = data.status ?? "PENDING";

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Automation Status</p>
        <div className="text-sm font-semibold text-slate-800">{STATUS_LABELS[status]}</div>
        <div className="text-xs text-slate-500">
          {data.lastQueuedAt && (
            <div>Queued: {new Date(data.lastQueuedAt).toLocaleString()}</div>
          )}
          {data.lastCompletedAt && (
            <div>Last Completed: {new Date(data.lastCompletedAt).toLocaleString()}</div>
          )}
        </div>
      </div>

      {data.lastError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <p className="font-semibold mb-1">Last Error</p>
          <p>{data.lastError}</p>
        </div>
      )}

      {data.lastResult != null && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-semibold text-emerald-700 uppercase mb-1">Last Result Payload</p>
          <pre className="whitespace-pre-wrap text-xs text-emerald-900">
            {JSON.stringify(data.lastResult, null, 2)}
          </pre>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Logs</p>
        {data.logs && data.logs.length > 0 ? (
          <div className="space-y-2 max-h-40 overflow-y-auto text-xs">
            {data.logs.map((log, idx) => (
              <div key={`${log.at}-${idx}`} className="border-l-2 border-slate-200 pl-2">
                <div className="font-semibold text-slate-700">
                  {new Date(log.at).toLocaleString()} · {log.level ?? "INFO"}
                </div>
                <div className="text-slate-600">{log.message}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">No log entries yet</p>
        )}
      </div>
    </div>
  );
}
