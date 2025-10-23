"use client";

import { useState } from "react";
import { CheckCheck, Loader2 } from "lucide-react";

type TaskExecutionProps = {
  step: {
    id: string;
    actionData: Record<string, unknown> | null;
  };
  onComplete: (payload: { notes?: string }) => void;
  isLoading: boolean;
};

/**
 * TaskExecution component for completing simple task workflow steps.
 * 
 * Features:
 * - Optional completion notes
 * - Simple completion flow
 */
export function TaskExecution({ 
  step,
  onComplete,
  isLoading,
}: TaskExecutionProps) {
  const [notes, setNotes] = useState("");

  const config = (step.actionData as Record<string, unknown>)?.config as Record<string, unknown> | undefined;
  const description = (config?.description as string) ?? "";
  const estimatedMinutes = (config?.estimatedMinutes as number) ?? 0;

  function handleComplete() {
    onComplete({
      notes: notes.trim() || undefined,
    });
  }

  return (
    <div className="mt-3 rounded-lg border-2 border-cyan-200 bg-cyan-50/50 p-4">
      <h5 className="mb-3 font-semibold text-cyan-900 flex items-center gap-2">
        <CheckCheck className="h-5 w-5" />
        Complete Task
      </h5>

      {/* Task Description */}
      {description && (
        <div className="mb-3 rounded-lg border border-cyan-200 bg-white p-3 text-sm text-slate-700">
          {description}
          {estimatedMinutes > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              Estimated time: ~{estimatedMinutes} minutes
            </p>
          )}
        </div>
      )}

      {/* Completion Notes */}
      <div className="mb-3">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Completion Notes (Optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-cyan-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
          placeholder="Add any notes about completing this task..."
        />
      </div>

      {/* Complete Button */}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={handleComplete}
          disabled={isLoading}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
              Completing...
            </>
          ) : (
            <>✓ Complete Task</>
          )}
        </button>
      </div>
    </div>
  );
}
