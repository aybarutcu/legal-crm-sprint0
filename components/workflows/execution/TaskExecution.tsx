"use client";

import { useState } from "react";
import { CheckCheck, Loader2, Upload, FileText } from "lucide-react";

type TaskExecutionProps = {
  stepId: string;
  instanceId: string;
  config: {
    description?: string;
    requiresEvidence?: boolean;
    estimatedMinutes?: number;
  };
  onComplete: () => void;
};

/**
 * TaskExecution component for completing simple task workflow steps.
 * 
 * Features:
 * - Optional completion notes
 * - Evidence (document) attachment when required
 * - Time estimate display
 * - Simple completion flow
 */
export function TaskExecution({ 
  stepId, 
  instanceId, 
  config, 
  onComplete 
}: TaskExecutionProps) {
  const [completing, setCompleting] = useState(false);
  const [notes, setNotes] = useState("");
  const [_evidenceIds, _setEvidenceIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleComplete() {
    // Validate evidence requirement
    if (config.requiresEvidence && _evidenceIds.length === 0) {
      setError("This task requires evidence documents to be attached.");
      return;
    }

    setCompleting(true);
    setError(null);

    try {
      // Complete the step
      const response = await fetch(
        `/api/workflows/instances/${instanceId}/steps/${stepId}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notes: notes.trim() || undefined,
            evidence: _evidenceIds.length > 0 ? _evidenceIds : undefined,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to complete task");
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete task");
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Task Description */}
      {config.description && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCheck className="h-5 w-5 text-cyan-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-slate-700">{config.description}</p>
              {config.estimatedMinutes && (
                <p className="mt-2 text-xs text-slate-500">
                  Estimated time: ~{config.estimatedMinutes} minutes
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Completion Notes */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Completion Notes {!config.requiresEvidence && "(Optional)"}
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
          placeholder="Add any notes about completing this task..."
        />
      </div>

      {/* Evidence Upload (if required) */}
      {config.requiresEvidence && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Evidence Documents <span className="text-red-500">*</span>
          </label>
          <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <Upload className="h-8 w-8 text-slate-400" />
              <p className="text-sm text-slate-600">
                This task requires document evidence
              </p>
              <p className="text-xs text-slate-500">
                Upload proof of completion (receipts, filed documents, etc.)
              </p>
              {_evidenceIds.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {_evidenceIds.map((id: string) => (
                    <div
                      key={id}
                      className="flex items-center gap-2 rounded-md bg-cyan-50 px-3 py-1 text-sm text-cyan-700 border border-cyan-200"
                    >
                      <FileText className="h-4 w-4" />
                      <span className="font-mono text-xs">{id.slice(0, 8)}...</span>
                    </div>
                  ))}
                </div>
              )}
              {/* TODO: Integrate with document upload component */}
              <button
                type="button"
                className="mt-2 text-sm text-cyan-600 hover:text-cyan-700 font-medium"
                onClick={() => {
                  // Placeholder: Open document upload dialog
                  window.alert("Document upload integration coming soon");
                }}
              >
                Browse Files
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Complete Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleComplete}
          disabled={completing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {completing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Completing...
            </>
          ) : (
            <>
              <CheckCheck className="h-4 w-4" />
              Complete Task
            </>
          )}
        </button>
      </div>
    </div>
  );
}
